/**
 * 拉取 Fish Audio 声库，生成音色池草稿（D-139）：
 *   FISH_API_KEY=... node ./scripts/fish-voices.mjs [--langs zh,en,ja,ko] [--per 30] [--out content/voices.ts]
 * 只取 licensed（Fish 官方授权）且公开的 tts 声线，按语言各拉 N 把（按使用量排序），
 * 性别 / 气质从 tags 与标题里猜（男 / 女 / male / female / 少年 / 御姐 / cool / soft…），猜不到的记 nonbinary——
 * **生成的是草稿，人工筛过再提交**：听一遍、删掉不合适的、改标签、给六位种子角色各定一把（SEED_VOICES）。
 * key 从环境变量 FISH_API_KEY 拿，没有就读 .env.local 里的 EXPO_PUBLIC_FISH_API_KEY（npm run fish-voices 直接可用）。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function envLocal(name) {
  if (!existsSync('.env.local')) return '';
  const m = readFileSync('.env.local', 'utf8').match(new RegExp('^' + name + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const KEY = process.env.FISH_API_KEY || process.env.EXPO_PUBLIC_FISH_API_KEY || envLocal('EXPO_PUBLIC_FISH_API_KEY');
if (!KEY) {
  console.error('缺 FISH_API_KEY');
  process.exit(1);
}
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const LANGS = opt('langs', 'zh,en,ja,ko').split(',');
const PER = Number(opt('per', '30'));
const OUT = opt('out', 'content/voices.ts');

/** Fish 的语言码 → 我们的 */
const FISH_LANG = { zh: 'zh', en: 'en', ja: 'ja', ko: 'ko' };

const FEMALE = /女|female|girl|woman|lady|御姐|少女|萝莉|姐|お姉|女性|여성|소녀/i;
const MALE = /男|male|boy|man|guy|少年|大叔|青年|哥|お兄|男性|남성|소년/i;
/** 气质标签：命中就打（中文键，进 i18n） */
const TAGS = [
  ['温柔', /温柔|gentle|soft|warm|やさし|優し|다정/i],
  ['低沉', /低沉|deep|low|磁性|渋い|低음|중저음/i],
  ['清冷', /清冷|cool|冷|calm|クール|차분/i],
  ['少年感', /少年|young|youth|boy|少年感|ショタ|소년/i],
  ['御姐', /御姐|mature|sister|お姉|누나/i],
  ['活泼', /活泼|元气|cheer|bright|lively|energetic|元気|明るい|발랄/i],
  ['沙哑', /沙哑|husky|raspy|ハスキー|허스키/i],
  ['甜', /甜|sweet|cute|可爱|かわいい|귀여/i],
  ['成熟', /成熟|adult|mature|大人|성숙/i],
  ['人外', /龙|dragon|神|god|妖|demon|精灵|elf|兽|竜|魔|요괴/i],
];

async function list(lang) {
  const out = [];
  for (let page = 1; out.length < PER && page <= 5; page++) {
    const q = new URLSearchParams({
      page_size: '50',
      page_number: String(page),
      language: FISH_LANG[lang],
      licensed: 'true',
      sort_by: 'task_count',
    });
    const r = await fetch(`https://api.fish.audio/model?${q}`, { headers: { authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`list ${lang} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    for (const m of data.items ?? []) {
      if (m.type !== 'tts' || m.visibility !== 'public' || m.state !== 'trained' || m.dmca_taken_down) continue;
      const text = `${m.title} ${m.description ?? ''} ${(m.tags ?? []).join(' ')}`;
      const gender = FEMALE.test(text) && !MALE.test(text) ? 'female' : MALE.test(text) && !FEMALE.test(text) ? 'male' : 'nonbinary';
      const tags = TAGS.filter(([, re]) => re.test(text)).map(([k]) => k);
      out.push({ id: m._id, name: String(m.title).slice(0, 20), lang, gender, tags, uses: m.task_count ?? 0 });
      if (out.length >= PER) break;
    }
    if (!data.has_more) break;
  }
  return out;
}

const all = [];
for (const lang of LANGS) {
  const rows = await list(lang);
  console.log(`${lang}: ${rows.length} 把`);
  all.push(...rows);
}

const lines = all.map(
  (v) => `  { id: '${v.id}', name: ${JSON.stringify(v.name)}, lang: '${v.lang}', gender: '${v.gender}', tags: [${v.tags.map((x) => `'${x}'`).join(', ')}] }, // ${v.uses} 次`
);
const file = `/**
 * 音色池（D-139）：TA 的声音从这里选，不用 Fish Audio 整个公共声库（两百万个里大量模仿真人、未授权，红线 1）。
 * 只收 Fish 官方（licensed）与明确可商用的声线，按语言 × 性别 × 气质打标；创造 ⑧ 按角色推荐三把、可换一批。
 * 内容由 scripts/fish-voices.mjs 从 Fish 声库拉取并写入（需要 FISH_API_KEY）；人工筛过再提交。
 * 池子为空的语言不显示音色选择（无供给不摆入口）。
 * 生成于 ${new Date().toISOString().slice(0, 10)}。
 */

import type { Lang } from '@/lib/i18n';

export interface VoiceOption {
  /** Fish Audio reference_id */
  id: string;
  /** 声线名（显示用，各语言自己的名字） */
  name: string;
  lang: Lang;
  gender: 'male' | 'female' | 'nonbinary';
  /** 气质标签（中文键，推荐打分用；显示时 t()） */
  tags: string[];
}

export const VOICES: VoiceOption[] = [
${lines.join('\n')}
];

/** 六位种子角色各定一把（按原 id，-en / -ja / -ko 本地化版本按语言另配：键写 \`id@lang\`，没有就回落原 id） */
export const SEED_VOICES: Record<string, string> = {};
`;
writeFileSync(OUT, file);
console.log(`写入 ${OUT}：${all.length} 把。听一遍、筛掉不合适的、补 SEED_VOICES，再把标签补进 lib/i18n.ts。`);
