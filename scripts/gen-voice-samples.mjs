// 提前录好的试听（D-260）：恋爱类型的示例台词 × 音色池里的每把声音 × 四种语言，用 ElevenLabs 合成好，
// 传到 Supabase Storage 的公开桶 voice-samples（捏人时「听听 TA」直接下载来放，lib/voice-samples.ts）。
// 路径 = <模型>/<语言>/<声线>/<句子的哈希>.mp3，哈希与客户端同一个 FNV-1a；已经有的跳过，可以反复跑。
// 用法：npm run voice-samples（加 -- --dry 只数条数、不联网；读 .env.local：EXPO_PUBLIC_ELEVENLABS_API_KEY、EXPO_PUBLIC_SUPABASE_URL，
// 以及 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ACCESS_TOKEN——没有 service role key 时用管理令牌去取）。
// 改了示例台词或它的翻译、加了声音，再跑一次就补上；没跑到的那条客户端会退回现场合成。
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'voice-samples';
const LANGS = ['zh', 'en', 'ja', 'ko'];
const CONCURRENCY = 4;

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

/** FNV-1a，36 进制（lib/voice-samples.ts 的 sampleHash） */
function sampleHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(36);
}

/** 恋爱类型的示例台词（content/characters/index.ts 的 sample） */
function readSamples() {
  const src = fs.readFileSync(path.join(ROOT, 'content/characters/index.ts'), 'utf8');
  return [...src.matchAll(/^\s{4}sample: '([^']+)',$/gm)].map((m) => m[1]);
}

/** 词典里某个语言那一段的译文（lib/i18n.ts，各语言以哨兵结尾） */
function readDict(lang) {
  const src = fs.readFileSync(path.join(ROOT, 'lib/i18n.ts'), 'utf8');
  const end = src.indexOf(`// __${lang.toUpperCase()}_END__`);
  const start = lang === 'en' ? 0 : src.indexOf(`// __${{ ja: 'EN', ko: 'JA' }[lang]}_END__`);
  const part = src.slice(start, end);
  const dict = new Map();
  for (const m of part.matchAll(/^\s{2}'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),?$/gm)) {
    dict.set(m[1], (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return dict;
}

/** 音色池（content/voices.ts）：id 与它会的语言 */
function readVoices() {
  const src = fs.readFileSync(path.join(ROOT, 'content/voices.ts'), 'utf8');
  return [...src.matchAll(/\{ id: '([^']+)', name: '[^']*', vibe: '[^']*',(?: langs: \[([^\]]*)\],)? gender:/g)].map((m) => ({
    id: m[1],
    langs: m[2] ? [...m[2].matchAll(/'([a-z]+)'/g)].map((x) => x[1]) : LANGS,
  }));
}

async function serviceKey(env, ref) {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error('需要 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ACCESS_TOKEN');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`取 service role key 失败：${res.status}`);
  const keys = await res.json();
  const key = keys.find((k) => k.name === 'service_role')?.api_key;
  if (!key) throw new Error('项目里没找到 service_role key');
  return key;
}

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const eleven = env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  const model = env.EXPO_PUBLIC_ELEVENLABS_MODEL || 'eleven_v4_turbo';
  if (!url || !eleven) throw new Error('需要 EXPO_PUBLIC_SUPABASE_URL 与 EXPO_PUBLIC_ELEVENLABS_API_KEY');
  const dry = process.argv.includes('--dry');
  const ref = new URL(url).hostname.split('.')[0];
  const key = dry ? '' : await serviceKey(env, ref);
  const auth = { Authorization: `Bearer ${key}`, apikey: key };

  // 公开桶：没有就建
  const bucket = dry ? { status: 200 } : await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: auth });
  if (bucket.status !== 200) {
    const made = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ['audio/mpeg'] }),
    });
    if (!made.ok) throw new Error(`建桶失败：${made.status} ${await made.text()}`);
    console.log(`建了公开桶 ${BUCKET}`);
  }

  const samples = readSamples();
  const voices = readVoices();
  const jobs = [];
  for (const lang of LANGS) {
    const dict = lang === 'zh' ? null : readDict(lang);
    for (const zh of samples) {
      const text = dict ? dict.get(zh) : zh;
      if (!text) {
        console.warn(`[${lang}] 没有译文：${zh}`);
        continue;
      }
      for (const v of voices) if (v.langs.includes(lang)) jobs.push({ lang, text, voice: v.id, path: `${model}/${lang}/${v.id}/${sampleHash(text)}.mp3` });
    }
  }
  console.log(`${samples.length} 句 × ${voices.length} 把声音 × ${LANGS.length} 种语言 → ${jobs.length} 条`);
  if (dry) return;

  let made = 0;
  let skipped = 0;
  let failed = 0;
  const run = async (job) => {
    const head = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${job.path}`, { method: 'HEAD' });
    if (head.ok) {
      skipped++;
      return;
    }
    const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${job.voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': eleven, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: job.text, model_id: model, language_code: job.lang }),
    });
    if (!tts.ok) {
      failed++;
      console.warn(`合成失败 ${job.path}：${tts.status} ${(await tts.text()).slice(0, 160)}`);
      return;
    }
    const audio = Buffer.from(await tts.arrayBuffer());
    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${job.path}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
      body: audio,
    });
    if (!up.ok) {
      failed++;
      console.warn(`上传失败 ${job.path}：${up.status} ${(await up.text()).slice(0, 160)}`);
      return;
    }
    made++;
    if (made % 50 === 0) console.log(`…已传 ${made} 条`);
  };
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await run(queue.shift());
    })
  );
  console.log(`完成：新传 ${made}，已有跳过 ${skipped}，失败 ${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
