/**
 * 多模态输入（D-073）：让 TA 真的「听到」她的语音、「看到」她的照片。
 * - 语音 → 文字（D-074 双通道，D-139 按语言分流）：中 / 英走百度语音识别（vop.baidu.com，与千帆同一把 bce-v3 key：
 *   普通话极速版 80001 约 1.5s、界面英语时标准版 1737）；日 / 韩走多语种通道——默认 Fish transcribe-1（api.fish.audio/v1/asr，
 *   multipart，与合成同一把 key，自动识别语言），或 EXPO_PUBLIC_ASR_PROVIDER=whisper 走 Whisper 协议（EXPO_PUBLIC_ASR_*，Groq / OpenAI /
 *   硅基流动 / 百炼都是 /audio/transcriptions）。哪些语言走多语种通道由 CONFIG.asr.langs 定（lib/speech asrChannelFor）。
 * - 照片 → 描述：千帆视觉模型（默认 qwen3.5-397b-a17b）按 content/prompts/caption.ts 客观描述——只写画面、不描述人的长相（红线 #2）。
 * 两者产出的文字只作对话模型的上下文（messageContextText），TA 的回复仍由聊天引擎生成：主引擎不换模型、人设不漂。
 * 取路同 engine（D-057/D-069）：本地千帆 key 直连 > 登录走服务端代理 > 不可用抛错；失败原样抛出，界面露出原因。
 */

import { AudioQuality, IOSOutputFormat, RecordingPresets, type RecordingOptions } from 'expo-audio';
import { GenerationBlockedError, generationBlocked, reportUsage } from '@/core/usage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { imageCaptionSystem, IMAGE_CAPTION_USER } from '@/content/prompts';
import { CONFIG } from '@/core/config';
import { AiUnavailableError, aiRoute, envKey } from '@/lib/engine';
import { getLang, t } from '@/lib/i18n';
import { proxyJson } from '@/lib/proxy';
import { asrChannelFor, BAIDU_ASR_LANGS } from '@/lib/speech';

export const QIANFAN_VISION_MODEL = CONFIG.qianfanVisionModel;

/** 百度 ASR 的音频要求：16k 采样、单声道、16bit PCM（wav）；最长 60 秒 */
export const ASR_MAX_SECONDS = 59;
export const ASR_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

const ASR_STD_URL = 'https://vop.baidu.com/server_api';
const ASR_PRO_URL = 'https://vop.baidu.com/pro_api';
const QIANFAN_CHAT_URL = 'https://qianfan.baidubce.com/v2/chat/completions';
const CUID = 'everylove-app';

/** 多语种识别通道（D-139）：fish（与合成同一把 key）或 whisper（ASR_*）；本地没配 = 只有百度（中 / 英） */
const ASR_PROVIDER = CONFIG.asr.provider;
const ASR_BASE_URL = CONFIG.asr.baseUrl;
const ASR_API_KEY = CONFIG.asr.apiKey;
const ASR_MODEL = CONFIG.asr.model;
const FISH_KEY = CONFIG.fish.apiKey;
const FISH_ASR_URL = 'https://api.fish.audio/v1/asr';
export function asrConfigured(): boolean {
  return ASR_PROVIDER === 'fish' ? Boolean(FISH_KEY) : Boolean(ASR_BASE_URL && ASR_API_KEY);
}
/** 代理侧没配时的固定回应（supabase/functions/ai），客户端据此回落百度 */
export const ASR_UNCONFIGURED = 'asr not configured';
export const FISH_ASR_UNCONFIGURED = 'fish not configured';
const UNCONFIGURED = [ASR_UNCONFIGURED, FISH_ASR_UNCONFIGURED];

type WhisperJson = { text?: string; error?: unknown };

/** Fish transcribe-1 直连：multipart 字段叫 audio，language 只是提示、语言自动识别 */
async function transcribeFishDirect(uri: string, language: string): Promise<string> {
  const res = await FileSystem.uploadAsync(FISH_ASR_URL, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/wav',
    parameters: { language },
    headers: { authorization: `Bearer ${FISH_KEY}` },
  });
  if (res.status >= 300) throw new Error(`Fish ASR ${res.status}: ${res.body.slice(0, 160)}`);
  const text = ((JSON.parse(res.body) as WhisperJson).text ?? '').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  return text;
}

/** Fish 走代理：key 在服务端，客户端传 base64（supabase/functions/ai：fish.asr） */
async function transcribeFishProxy(audioBase64: string, language: string): Promise<string> {
  const data = await proxyJson<WhisperJson>('fish.asr', { audio_base64: audioBase64, filename: 'voice.wav', mime: 'audio/wav', language });
  const text = (data.text ?? '').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  return text;
}

/** Whisper 协议直连：multipart 上传录音文件（uploadAsync 直接传文件，不经内存 base64） */
async function transcribeWhisperDirect(uri: string, language: string): Promise<string> {
  const res = await FileSystem.uploadAsync(`${ASR_BASE_URL}/audio/transcriptions`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'audio/wav',
    parameters: { model: ASR_MODEL, language, response_format: 'json' },
    headers: { authorization: `Bearer ${ASR_API_KEY}` },
  });
  if (res.status >= 300) throw new Error(`Whisper ${res.status}: ${res.body.slice(0, 160)}`);
  const text = ((JSON.parse(res.body) as WhisperJson).text ?? '').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  return text;
}

/** Whisper 协议走代理：key 在服务端，客户端传 base64（supabase/functions/ai：asr.transcribe） */
async function transcribeWhisperProxy(audioBase64: string, language: string): Promise<string> {
  const data = await proxyJson<WhisperJson>('asr.transcribe', {
    audio_base64: audioBase64,
    filename: 'voice.wav',
    mime: 'audio/wav',
    language,
  });
  const text = (data.text ?? '').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  return text;
}

/** dev_pid：80001 极速版普通话 / 1537 普通话 / 1737 英语（EXPO_PUBLIC_BAIDU_ASR_DEV_PID 可强制） */
function asrDevPid(): number {
  if (CONFIG.baiduAsrDevPid) return CONFIG.baiduAsrDevPid;
  return getLang() === 'en' ? 1737 : 80001;
}

type AsrResponse = { err_no?: number; err_msg?: string; result?: string[] };

/**
 * 语音 → 文字（D-139 按语言分流）：中 / 英 → 百度（直连或代理）；日 / 韩 → Whisper 通道（本地直连，或代理侧配了才有）。
 * 百度不会的语言、Whisper 又没接上 → 直接说「这门语言的语音识别还没接上」，不假装听到了。空结果也算失败。
 */
export async function transcribeVoice(uri: string): Promise<string> {
  const lang = getLang();
  const blocked = generationBlocked('asr');
  if (blocked) throw new GenerationBlockedError(blocked);
  const route = await aiRoute('qianfan');
  // 代理侧的 Whisper 通道要试过才知道有没有：先乐观放行，503 再回落
  const channel = asrChannelFor(lang, { multi: asrConfigured() || route === 'proxy', baidu: route !== 'none' });
  if (channel === 'none') {
    if (route === 'none') throw new AiUnavailableError();
    throw new Error(t('这门语言的语音识别还没接上'));
  }
  if (channel === 'multi' && asrConfigured()) {
    const text = ASR_PROVIDER === 'fish' ? await transcribeFishDirect(uri, lang) : await transcribeWhisperDirect(uri, lang);
    reportUsage({ kind: 'asr', provider: ASR_PROVIDER, seconds: 15, estimated: true });
    return text;
  }
  if (route === 'none') throw new AiUnavailableError();
  const info = await FileSystem.getInfoAsync(uri);
  const len = info.exists && 'size' in info ? info.size : 0;
  if (!len) throw new Error(t('录音文件是空的'));
  const speech = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (channel === 'multi') {
    try {
      const text = ASR_PROVIDER === 'fish' ? await transcribeFishProxy(speech, lang) : await transcribeWhisperProxy(speech, lang);
      reportUsage({ kind: 'asr', provider: ASR_PROVIDER, seconds: len / 32000, estimated: true });
      return text;
    } catch (e) {
      if (!UNCONFIGURED.some((m) => String(e).includes(m))) throw e;
      if (!BAIDU_ASR_LANGS.includes(lang)) throw new Error(t('这门语言的语音识别还没接上'));
    }
  }
  const ext = (uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  const format = ext === 'm4a' ? 'm4a' : ext === 'amr' ? 'amr' : ext === 'wav' ? 'wav' : 'pcm';
  const devPid = asrDevPid();
  const pro = devPid === 80001;
  const body = { format, rate: 16000, channel: 1, cuid: CUID, len, speech, dev_pid: devPid };
  let data: AsrResponse;
  if (route === 'direct') {
    const res = await fetch(pro ? ASR_PRO_URL : ASR_STD_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${envKey('qianfan')}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Baidu ASR ${res.status}`);
    data = (await res.json()) as AsrResponse;
  } else {
    data = await proxyJson<AsrResponse>(pro ? 'baidu.asr_pro' : 'baidu.asr', body);
  }
  if (data.err_no !== 0) {
    throw new Error(`Baidu ASR ${data.err_no ?? '?'}: ${data.err_msg ?? ''}`.trim());
  }
  const text = (data.result ?? []).join('').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  // 16 kHz 16 bit ≈ 32 KB / 秒
  reportUsage({ kind: 'asr', provider: 'baidu', seconds: len / 32000, estimated: true });
  return text;
}

type ChatJson = { choices?: { message?: { content?: string } }[] };

/** 照片 → 客观描述。先缩到宽 1024、JPEG 0.75，控制上传体积与 token */
export async function describeImage(uri: string): Promise<string> {
  const route = await aiRoute('qianfan');
  if (route === 'none') throw new AiUnavailableError();
  const blocked = generationBlocked('vision');
  if (blocked) throw new GenerationBlockedError(blocked);
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error('image encode failed');
  const body = {
    model: QIANFAN_VISION_MODEL,
    max_tokens: 400,
    messages: [
      { role: 'system', content: imageCaptionSystem() },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${small.base64}` } },
          { type: 'text', text: IMAGE_CAPTION_USER },
        ],
      },
    ],
  };
  let data: ChatJson;
  if (route === 'direct') {
    const res = await fetch(QIANFAN_CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${envKey('qianfan')}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Qianfan VL ${res.status}`);
    data = (await res.json()) as ChatJson;
  } else {
    data = await proxyJson<ChatJson>('qianfan.chat', body);
  }
  const caption = data.choices?.[0]?.message?.content?.trim();
  if (!caption) throw new Error('empty caption');
  reportUsage({ kind: 'vision', provider: QIANFAN_VISION_MODEL });
  return caption.replace(/\s+/g, ' ').slice(0, 400);
}
