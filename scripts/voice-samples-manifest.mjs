// 试听录音的句子清单（D-260）：从源码导出「恋爱类型的示例台词（四语）× 音色池的声线」，
// 写进 supabase/functions/_shared/voice-sample-lines.ts——代理的 eleven.sample 只认清单里的句子与声线。
// 录音本身按需生成（第一个用到的人触发服务器合成、存进公开桶），不批量跑。
// 用法：npm run voice-samples（改了示例台词、译文或音色池后跑一次，再部署 functions/ai；tests/character-form.test.ts 会检查清单与源码一致）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'supabase/functions/_shared/voice-sample-lines.ts');

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
  const dict = new Map();
  for (const m of src.slice(start, end).matchAll(/^\s{2}'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),?$/gm)) {
    dict.set(m[1], (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return dict;
}

/** 音色池（content/voices.ts）的声线 id */
function readVoices() {
  const src = fs.readFileSync(path.join(ROOT, 'content/voices.ts'), 'utf8');
  return [...src.matchAll(/\{ id: '([^']+)', name: '[^']*'/g)].map((m) => m[1]);
}

const samples = readSamples();
const lines = { zh: samples };
for (const lang of ['en', 'ja', 'ko']) {
  const dict = readDict(lang);
  lines[lang] = samples.map((zh) => {
    const v = dict.get(zh);
    if (!v) throw new Error(`[${lang}] 没有译文：${zh}`);
    return v;
  });
}
const voices = readVoices();

const body = `// 由 npm run voice-samples（scripts/voice-samples-manifest.mjs）从源码生成，别手改。
// 恋爱类型的示例台词（四语）与音色池的声线：代理的 eleven.sample 只认这里面的（D-260）。

export const SAMPLE_LINES: Record<'zh' | 'en' | 'ja' | 'ko', string[]> = ${JSON.stringify(lines, null, 2)};

export const SAMPLE_VOICES: string[] = ${JSON.stringify(voices, null, 2)};
`;
fs.writeFileSync(OUT, body);
console.log(`写好了：${samples.length} 句 × 4 种语言，${voices.length} 把声线 → ${path.relative(ROOT, OUT)}`);
