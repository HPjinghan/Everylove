/**
 * AI 服务端代理（D-057）：唯一的自有服务端组件。
 * 职责：LLM/生图/语音的 API key 收在服务端（Supabase Secrets），客户端只带登录态调用；
 *      按用户限每日用量（ai_usage 表，防盗刷）。
 * 客户端协议：POST { service, body }，service ∈
 *   qianfan.chat / qianfan.images / anthropic.messages（JSON 透传）
 *   baidu.asr / baidu.asr_pro（百度语音识别，JSON；D-073）
 *   baidu.tts（百度短文本语音合成 tsn.baidu.com/text2audio，body 为表单字段对象；D-073，替代已下线的 qianfan.tts）
 *   speech.transcribe / speech.synthesize（OpenAI 兼容语音服务：Whisper 协议识别 + /audio/speech 合成，中/英/日全语种；D-074。
 *     Secrets：SPEECH_BASE_URL / SPEECH_API_KEY / SPEECH_ASR_MODEL / SPEECH_TTS_MODEL；没配返回 503「speech not configured」，客户端回落百度）
 * 返回：上游 JSON 原样透传；上游返回二进制音频则包成 { audio_base64 }。
 * 部署：supabase functions deploy ai（verify_jwt 开启——平台先验 JWT，函数内再取 user 限流）。
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const QIANFAN_KEY = Deno.env.get('QIANFAN_API_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '500');

const JSON_HEADERS = { 'content-type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** 上游是 JSON 就透传；是二进制音频就包成 { audio_base64 }（客户端统一处理） */
async function audioOrJson(r: Response): Promise<Response> {
  const contentType = r.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return new Response(await r.text(), { status: r.status, headers: JSON_HEADERS });
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return json({ audio_base64: btoa(bin) }, r.status);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    // 用请求者的 JWT 建客户端：RLS 生效，getUser 拿到本人
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    // 每日用量（防盗刷；配额是防滥用不是付费墙）
    const day = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('day', day)
      .maybeSingle();
    const count = usage?.count ?? 0;
    if (count >= DAILY_LIMIT) return json({ error: 'rate_limited', limit: DAILY_LIMIT }, 429);
    await supabase.from('ai_usage').upsert({ user_id: user.id, day, count: count + 1 });

    const { service, body } = (await req.json()) as { service: string; body: unknown };

    if (service === 'anthropic.messages') {
      if (!ANTHROPIC_KEY) return json({ error: 'anthropic key not configured' }, 503);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      return new Response(await r.text(), { status: r.status, headers: JSON_HEADERS });
    }

    // OpenAI 兼容语音服务（D-074）：Whisper 协议识别 + /audio/speech 合成；key 只在 Secrets
    if (service === 'speech.transcribe' || service === 'speech.synthesize') {
      const base = (Deno.env.get('SPEECH_BASE_URL') ?? '').replace(/\/+$/, '');
      const key = Deno.env.get('SPEECH_API_KEY') ?? '';
      if (!base || !key) return json({ error: 'speech not configured' }, 503);
      const b = body as Record<string, string>;
      if (service === 'speech.transcribe') {
        const bin = atob(b.audio_base64 ?? '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: b.mime || 'audio/wav' }), b.filename || 'voice.wav');
        form.append('model', Deno.env.get('SPEECH_ASR_MODEL') || 'whisper-1');
        if (b.language) form.append('language', b.language);
        form.append('response_format', 'json');
        const r = await fetch(`${base}/audio/transcriptions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}` },
          body: form,
        });
        return new Response(await r.text(), { status: r.status, headers: JSON_HEADERS });
      }
      const r = await fetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: Deno.env.get('SPEECH_TTS_MODEL') || 'gpt-4o-mini-tts',
          input: b.input,
          voice: b.voice,
          response_format: b.response_format || 'mp3',
        }),
      });
      return await audioOrJson(r);
    }

    // 千帆 v2 与百度语音同一把 bce-v3 key：ASR 是 JSON，TTS 是表单（D-073）
    const JSON_ROUTES: Record<string, string> = {
      'qianfan.chat': 'https://qianfan.baidubce.com/v2/chat/completions',
      'qianfan.images': 'https://qianfan.baidubce.com/v2/images/generations',
      // 百度蒸汽机 Air-Image 专用端点（D-071/D-076：动漫画风走它；通用端点对它不回）
      'qianfan.musesteamer': 'https://qianfan.baidubce.com/v2/musesteamer/images/generations',
      'baidu.asr': 'https://vop.baidu.com/server_api',
      'baidu.asr_pro': 'https://vop.baidu.com/pro_api',
    };
    const FORM_ROUTES: Record<string, string> = {
      'baidu.tts': 'https://tsn.baidu.com/text2audio',
    };
    const upstream = JSON_ROUTES[service] ?? FORM_ROUTES[service];
    if (!upstream) return json({ error: `unknown service: ${service}` }, 400);
    if (!QIANFAN_KEY) return json({ error: 'qianfan key not configured' }, 503);

    const isForm = service in FORM_ROUTES;
    const r = await fetch(upstream, {
      method: 'POST',
      headers: {
        'content-type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        authorization: `Bearer ${QIANFAN_KEY}`,
      },
      body: isForm
        ? new URLSearchParams(body as Record<string, string>).toString()
        : JSON.stringify(body),
    });
    return await audioOrJson(r);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
