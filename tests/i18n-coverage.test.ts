/**
 * 词典覆盖（D-105）：界面里凡是套了 t() 的中文，以及经 t(x.label) 动态取键的数据表（App 名、壁纸 / 配色名、
 * 天况与天气小文案、口味选项），en / ja / ko 三本词典都必须有词——缺词只会静默回落中文，界面上看不出来。
 * 纯文本扫描：不跑 React Native，直接读源码。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hasTranslation, type Lang } from '@/lib/i18n';

const ROOT = join(__dirname, '..');
const LANGS: Exclude<Lang, 'zh'>[] = ['en', 'ja', 'ko'];
const HAN = /[一-鿿]/;
/** 语言选项用各自母语写、永远不翻 */
const NATIVE_NAMES = new Set(['中文', '日本語', '한국어']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function unescape(s: string): string {
  return s.replace(/\\'/g, "'").replace(/\\n/g, '\n');
}

/** 源码里所有 t('…') / t("…") 的字面键 */
function literalKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const files = ['app', 'components', 'lib', 'features', 'constants'].flatMap((d) => walk(join(ROOT, d)));
  for (const f of files) {
    if (f.endsWith('i18n.ts')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.set(unescape(m[1]), f);
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.set(unescape(m[1]), f);
  }
  return keys;
}

/** 数据表里经 t(x.label) 等动态取键的中文：这些文件里 label / line / name 字段的字面值 */
const DATA_FILES = [
  'constants/apps.ts',
  'constants/theme.ts',
  'lib/weather.ts',
  'app/apps/dating.tsx',
  'app/onboarding.tsx',
  'app/apps/identity.tsx',
];
function dataKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const rel of DATA_FILES) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(/\b(?:label|line|name)\s*:\s*'((?:[^'\\]|\\.)*)'/g)) {
      const v = unescape(m[1]);
      if (HAN.test(v) && !NATIVE_NAMES.has(v)) keys.set(v, rel);
    }
  }
  return keys;
}

describe('三语词典覆盖', () => {
  it('每个 t() 字面键三本词典都有', () => {
    const missing: string[] = [];
    for (const [key, file] of literalKeys()) {
      for (const lang of LANGS) if (!hasTranslation(key, lang)) missing.push(`${lang}  ${key}  (${file})`);
    }
    expect(missing).toEqual([]);
  });
  it('数据表里的中文标签三本词典都有', () => {
    const missing: string[] = [];
    for (const [key, file] of dataKeys()) {
      for (const lang of LANGS) if (!hasTranslation(key, lang)) missing.push(`${lang}  ${key}  (${file})`);
    }
    expect(missing).toEqual([]);
  });
});
