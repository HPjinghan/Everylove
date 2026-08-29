/**
 * AI 服务端代理（D-057）：唯一的自有服务端组件。
 * 职责：LLM/生图/语音的 API key 收在服务端（Supabase Secrets），客户端只带登录态调用；
 *      按用户限每日用量（ai_usage 表，防盗刷）。
 * 客户端协议：POST { service, body }，service ∈
 *   qianfan.chat / qianfan.images / qianfan.tts / anthropic.messages
 * 返回：上游 JSON 原样透传；TTS 上游若返回二进制则包成 { audio_base64 }。
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

    const QIANFAN_ROUTES: Record<string, string> = {
      'qianfan.chat': 'https://qianfan.baidubce.com/v2/chat/completions',
      'qianfan.images': 'https://qianfan.baidubce.com/v2/images/generations',
      'qianfan.tts': 'https://qianfan.baidubce.com/v2/audio/speech',
    };
    const upstream = QIANFAN_ROUTES[service];
    if (!upstream) return json({ error: `unknown service: ${service}` }, 400);
    if (!QIANFAN_KEY) return json({ error: 'qianfan key not configured' }, 503);

    const r = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${QIANFAN_KEY}` },
      body: JSON.stringify(body),
    });
    const contentType = r.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return new Response(await r.text(), { status: r.status, headers: JSON_HEADERS });
    }
    // TTS 二进制流 → 包成 base64 JSON（客户端统一处理）
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return json({ audio_base64: btoa(bin) }, r.status);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
