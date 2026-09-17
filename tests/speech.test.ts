/**
 * 语音供给（D-139）：识别按语言分流、音色池推荐与默认音色。
 */
import { describe, expect, it } from 'vitest';

import { VOICES } from '@/content/voices';
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
    { id: 'm1', name: '男一', lang: 'zh' as const, gender: 'male' as const, tags: ['温柔'] },
    { id: 'm2', name: '男二', lang: 'zh' as const, gender: 'male' as const, tags: ['低沉'] },
    { id: 'm3', name: '男三', lang: 'zh' as const, gender: 'male' as const, tags: ['少年感'] },
    { id: 'm4', name: '男四', lang: 'zh' as const, gender: 'male' as const, tags: ['清冷'] },
    { id: 'f1', name: '女一', lang: 'zh' as const, gender: 'female' as const, tags: ['甜'] },
    { id: 'j1', name: '日一', lang: 'ja' as const, gender: 'male' as const, tags: [] },
  ];
  const withPool = (fn: () => void) => {
    VOICES.splice(0, VOICES.length, ...pool);
    try {
      fn();
    } finally {
      VOICES.splice(0, VOICES.length);
    }
  };

  it('池子空时不推荐、默认音色回落 env（空字符串 = Fish 默认声）', () => {
    expect(recommendVoices({ lang: 'zh', gender: 'male' })).toEqual([]);
    expect(defaultVoiceId({ id: 'x', loveTag: 'male' }, 'zh')).toBe('');
  });

  it('同语言同性别里按提示词命中排前，三把一批、换一批循环、池子不够全给', () => {
    withPool(() => {
      const r0 = recommendVoices({ lang: 'zh', gender: 'male', hints: ['清冷'] }, 0);
      expect(r0.map((v) => v.id)).toEqual(['m4', 'm1', 'm2']);
      const r1 = recommendVoices({ lang: 'zh', gender: 'male', hints: ['清冷'] }, 1);
      expect(r1.map((v) => v.id)).toEqual(['m3', 'm4', 'm1']);
      expect(recommendVoices({ lang: 'zh', gender: 'female' }).map((v) => v.id)).toEqual(['f1']);
      expect(recommendVoices({ lang: 'ja', gender: 'female' })).toEqual([]);
      expect(recommendVoices({ lang: 'ja', gender: 'nonbinary' }).map((v) => v.id)).toEqual(['j1']);
      expect(recommendVoices({ lang: 'ko', gender: 'male' })).toEqual([]);
    });
  });

  it('默认音色：同语言同性别第一把；性别按 gender > loveTag 推', () => {
    withPool(() => {
      expect(defaultVoiceId({ id: 'x', loveTag: 'female' }, 'zh')).toBe('f1');
      expect(defaultVoiceId({ id: 'x', loveTag: 'male' }, 'ja')).toBe('j1');
      expect(defaultVoiceId({ id: 'x', loveTag: 'nonhuman', gender: 'male' }, 'zh')).toBe('m1');
      expect(defaultVoiceId({ id: 'shen-zhiyan-ja', loveTag: 'male' }, 'ko')).toBe('');
      expect(voiceGenderOf({ loveTag: 'nonhuman' })).toBe('nonbinary');
    });
  });
});
