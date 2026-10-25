/**
 * 语音供给（D-139 / D-230）：识别按语言分流、音色池按恋爱类型推荐与默认音色。
 */
import { describe, expect, it } from 'vitest';

import { CHARACTERS, LOVE_STYLES } from '@/content/characters';
import { seedBaseId } from '@/content/portraits';
import { SEED_STYLES, VOICES } from '@/content/voices';
import { asrChannelFor, defaultVoiceId, recommendVoices, voiceGenderOf, multiAsrWanted } from '@/lib/speech';

describe('识别分流', () => {
  const both = { multi: true, baidu: true };
  it('默认只有日 / 韩走多语种通道，中 / 英走百度；all = 全部走多语种', () => {
    expect(asrChannelFor('zh', both)).toBe('baidu');
    expect(asrChannelFor('en', both)).toBe('baidu');
    expect(asrChannelFor('ja', both)).toBe('multi');
    expect(asrChannelFor('ko', both)).toBe('multi');
    expect(asrChannelFor('zh', both, 'all')).toBe('multi');
    expect(multiAsrWanted('en', 'en, ja')).toBe(true);
  });
  it('百度不会的语言、多语种通道没接上 → none；只有多语种通道时中文也走它', () => {
    expect(asrChannelFor('ja', { multi: false, baidu: true })).toBe('none');
    expect(asrChannelFor('zh', { multi: false, baidu: true })).toBe('baidu');
    expect(asrChannelFor('zh', { multi: true, baidu: false })).toBe('multi');
    expect(asrChannelFor('zh', { multi: false, baidu: false })).toBe('none');
  });
});

describe('音色池', () => {
  const pool = [
    { id: 'm1', name: '男一', lang: 'zh' as const, gender: 'male' as const, styles: ['温柔年上'] },
    { id: 'm2', name: '男二', lang: 'zh' as const, gender: 'male' as const, styles: ['霸总'] },
    { id: 'm3', name: '男三', lang: 'zh' as const, gender: 'male' as const, styles: ['小狗系年下'] },
    { id: 'm4', name: '男四', lang: 'zh' as const, gender: 'male' as const, styles: ['高冷禁欲', '毒舌竹马'] },
    { id: 'f1', name: '女一', lang: 'zh' as const, gender: 'female' as const, styles: ['甜'] },
    { id: 'f2', name: '女二', lang: 'zh' as const, gender: 'female' as const, styles: ['姐姐系'] },
    { id: 'j1', name: '日一', lang: 'ja' as const, gender: 'male' as const, styles: [] },
  ];
  const withPool = (fn: () => void) => {
    const real = VOICES.splice(0, VOICES.length, ...pool);
    try {
      fn();
    } finally {
      VOICES.splice(0, VOICES.length, ...real);
    }
  };

  it('池子空时不推荐、默认音色回落 env（空字符串 = Fish 默认声）', () => {
    const real = VOICES.splice(0, VOICES.length);
    try {
      expect(recommendVoices({ lang: 'zh', gender: 'male' })).toEqual([]);
      expect(defaultVoiceId({ id: 'x', loveTag: 'male' }, 'zh')).toBe('');
    } finally {
      VOICES.splice(0, 0, ...real);
    }
  });

  it('同语言同性别里对应恋爱类型的排前，三把一批、换一批循环、池子不够全给', () => {
    withPool(() => {
      const r0 = recommendVoices({ lang: 'zh', gender: 'male', hints: ['高冷禁欲'] }, 0);
      expect(r0.map((v) => v.id)).toEqual(['m4', 'm1', 'm2']);
      const r1 = recommendVoices({ lang: 'zh', gender: 'male', hints: ['高冷禁欲'] }, 1);
      expect(r1.map((v) => v.id)).toEqual(['m3', 'm4', 'm1']);
      expect(recommendVoices({ lang: 'zh', gender: 'female' }).map((v) => v.id)).toEqual(['f1', 'f2']);
      expect(recommendVoices({ lang: 'ja', gender: 'female' })).toEqual([]);
      expect(recommendVoices({ lang: 'ja', gender: 'nonbinary' }).map((v) => v.id)).toEqual(['j1']);
      expect(recommendVoices({ lang: 'ko', gender: 'male' })).toEqual([]);
    });
  });

  it('默认音色：按恋爱类型 > 原型 > 同性别第一把；种子按预定类型；性别按 gender > loveTag 推', () => {
    withPool(() => {
      expect(defaultVoiceId({ id: 'x', loveTag: 'male', loveStyle: '毒舌竹马' }, 'zh')).toBe('m4');
      expect(defaultVoiceId({ id: 'x', loveTag: 'male', archetype: 'ceo' }, 'zh')).toBe('m2');
      expect(defaultVoiceId({ id: 'x', loveTag: 'female', loveStyle: '姐姐系' }, 'zh')).toBe('f2');
      expect(defaultVoiceId({ id: 'x', loveTag: 'female', loveStyle: '霸总' }, 'zh')).toBe('f1');
      expect(defaultVoiceId({ id: 'x', loveTag: 'male' }, 'ja')).toBe('j1');
      expect(defaultVoiceId({ id: 'x', loveTag: 'nonhuman', gender: 'male' }, 'zh')).toBe('m1');
      expect(defaultVoiceId({ id: 'jiang-ye-ja', loveTag: 'male' }, 'zh')).toBe('m4');
      expect(defaultVoiceId({ id: 'shen-zhiyan-ja', loveTag: 'male' }, 'ko')).toBe('');
      expect(voiceGenderOf({ loveTag: 'nonhuman' })).toBe('nonbinary');
      expect(voiceGenderOf({ loveTag: 'nonhuman', pronoun: '她' })).toBe('female');
    });
  });
});

describe('音色池内容（D-230）', () => {
  it('每门语言 × 男 / 女，14 种恋爱类型各恰好一把默认声', () => {
    for (const lang of ['zh', 'en', 'ja', 'ko'] as const) {
      for (const gender of ['male', 'female'] as const) {
        const pool = VOICES.filter((v) => v.lang === lang && v.gender === gender);
        for (const s of LOVE_STYLES) {
          expect(pool.filter((v) => v.styles.includes(s.label)).length, `${lang} ${gender} ${s.label}`).toBe(1);
        }
        for (const v of pool) for (const st of v.styles) expect(LOVE_STYLES.some((s) => s.label === st), st).toBe(true);
      }
    }
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length);
  });

  it('六位种子在四门语言都落到对应性别的声线上', () => {
    for (const c of CHARACTERS.filter((x) => SEED_STYLES[seedBaseId(x.id)])) {
      for (const lang of ['zh', 'en', 'ja', 'ko'] as const) {
        const v = VOICES.find((x) => x.id === defaultVoiceId(c, lang));
        expect(v?.lang, `${c.id} ${lang}`).toBe(lang);
        expect(v?.styles).toContain(SEED_STYLES[seedBaseId(c.id)]);
        if (c.pronoun === '他') expect(v?.gender).toBe('male');
        if (c.pronoun === '她') expect(v?.gender).toBe('female');
      }
    }
  });
});
