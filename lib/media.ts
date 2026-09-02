/**
 * 多模态输入（D-073）：让 TA 真的「听到」她的语音、「看到」她的照片。
 * - 语音 → 文字（D-074 双通道）：配了 OpenAI 兼容语音服务（EXPO_PUBLIC_SPEECH_*，Whisper 协议 /audio/transcriptions——
 *   OpenAI / Groq / 硅基流动 / 阿里百炼都是这一套）就走它：中/英/日全语种、带界面语言提示；没配则回落百度语音识别
 *   （vop.baidu.com，与千帆同一把 bce-v3 key：普通话极速版 80001 约 1.5s、界面英语时标准版 1737；日语不支持，OPEN_QUESTIONS #25）。
 * - 照片 → 描述：千帆视觉模型（默认 qwen3.5-397b-a17b）按 prompts.ts §6 客观描述——只写画面、不描述人的长相（红线 #2）。
 * 两者产出的文字只作对话模型的上下文（messageContextText），TA 的回复仍由聊天引擎生成：主引擎不换模型、人设不漂。
 * 取路同 engine（D-057/D-069）：本地千帆 key 直连 > 登录走服务端代理 > 不可用抛错；失败原样抛出，界面露出原因。
 */

import { AudioQuality, IOSOutputFormat, RecordingPresets, type RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { IMAGE_CAPTION_SYSTEM, IMAGE_CAPTION_USER } from '@/content/prompts';
import { AiUnavailableError, aiRoute, envKey } from '@/lib/engine';
import { getLang, t } from '@/lib/i18n';
import { proxyJson } from '@/lib/proxy';

export const QIANFAN_VISION_MODEL =
  process.env.EXPO_PUBLIC_QIANFAN_VISION_MODEL || 'qwen3.5-397b-a17b';

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

/** OpenAI 兼容语音服务（D-074）：语音识别与合成共用一个 base URL + key；不填 = 用百度 */
export const SPEECH_BASE_URL = (process.env.EXPO_PUBLIC_SPEECH_BASE_URL || '').replace(/\/+$/, '');
export const SPEECH_API_KEY = process.env.EXPO_PUBLIC_SPEECH_API_KEY || '';
export const SPEECH_ASR_MODEL = process.env.EXPO_PUBLIC_SPEECH_ASR_MODEL || 'whisper-1';
export function speechConfigured(): boolean {
  return Boolean(SPEECH_BASE_URL && SPEECH_API_KEY);
}
/** 代理侧没配 SPEECH_* 时的固定回应（supabase/functions/ai），客户端据此回落百度 */
export const SPEECH_UNCONFIGURED = 'speech not configured';

type WhisperJson = { text?: string; error?: unknown };

/** Whisper 协议直连：multipart 上传录音文件（uploadAsync 直接传文件，不经内存 base64） */
async function transcribeWhisperDirect(uri: string, language: string): Promise<string> {
  const res = await FileSystem.uploadAsync(`${SPEECH_BASE_URL}/audio/transcriptions`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'audio/wav',
    parameters: { model: SPEECH_ASR_MODEL, language, response_format: 'json' },
    headers: { authorization: `Bearer ${SPEECH_API_KEY}` },
  });
  if (res.status >= 300) throw new Error(`Whisper ${res.status}: ${res.body.slice(0, 160)}`);
  const text = ((JSON.parse(res.body) as WhisperJson).text ?? '').trim();
  if (!text) throw new Error(t('没听清这段语音（识别结果为空）'));
  return text;
}

/** Whisper 协议走代理：key 在服务端，客户端传 base64（supabase/functions/ai：speech.transcribe） */
async function transcribeWhisperProxy(audioBase64: string, language: string): Promise<string> {
  const data = await proxyJson<WhisperJson>('speech.transcribe', {
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
  const forced = Number(process.env.EXPO_PUBLIC_BAIDU_ASR_DEV_PID);
  if (forced) return forced;
  return getLang() === 'en' ? 1737 : 80001;
}

type AsrResponse = { err_no?: number; err_msg?: string; result?: string[] };

/**
 * 语音 → 文字。通道顺序：本地 OpenAI 兼容服务直连 > 代理侧 OpenAI 兼容服务 > 百度（直连或代理）。
 * 空结果也算失败：她说了什么没听清，不能假装听到了。
 */
export async function transcribeVoice(uri: string): Promise<string> {
  const lang = getLang();
  if (speechConfigured()) return transcribeWhisperDirect(uri, lang);
  const route = await aiRoute('qianfan');
  if (route === 'none') throw new AiUnavailableError();
  const info = await FileSystem.getInfoAsync(uri);
  const len = info.exists && 'size' in info ? info.size : 0;
  if (!len) throw new Error(t('录音文件是空的'));
  const speech = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (route === 'proxy') {
    try {
      return await transcribeWhisperProxy(speech, lang);
    } catch (e) {
      if (!String(e).includes(SPEECH_UNCONFIGURED)) throw e;
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
  return text;
}

type ChatJson = { choices?: { message?: { content?: string } }[] };

/** 照片 → 客观描述。先缩到宽 1024、JPEG 0.75，控制上传体积与 token */
export async function describeImage(uri: string): Promise<string> {
  const route = await aiRoute('qianfan');
  if (route === 'none') throw new AiUnavailableError();
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
      { role: 'system', content: IMAGE_CAPTION_SYSTEM },
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
  return caption.replace(/\s+/g, ' ').slice(0, 400);
}
