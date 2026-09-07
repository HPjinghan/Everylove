/**
 * 她在 TA 心里的分量（D-099）：恋爱类型 → 追法家族兜底，叠 MBTI 与主动强度，夹 0.1～0.9，三档。
 */
import { describe, expect, it } from 'vitest';

import { herShare, herShareTier, rollAboutHer } from '@/lib/her-share';

describe('她在 TA 心里的分量', () => {
  it('种子角色只有追法家族：按家族兜底', () => {
    expect(herShare({ archetype: 'gentle' })).toBe(0.5);
    expect(herShareTier({ archetype: 'gentle' })).toBe('balanced');
    expect(herShare({ archetype: 'ceo' })).toBe(0.3);
    expect(herShareTier({ archetype: 'ceo' })).toBe('independent');
  });
  it('恋爱脑：依恋型 + INFP + 高主动 → 封顶 0.9', () => {
    const c = { archetype: 'gentle' as const, loveStyle: '依恋型', mbti: 'infp', initiative: 'high' as const };
    expect(herShare(c)).toBe(0.9);
    expect(herShareTier(c)).toBe('devoted');
  });
  it('冷静理智：冷静大人 + INTJ + 低主动 → 保底 0.1', () => {
    const c = { archetype: 'ceo' as const, loveStyle: '冷静大人', mbti: 'INTJ', initiative: 'low' as const };
    expect(herShare(c)).toBe(0.1);
    expect(herShareTier(c)).toBe('independent');
  });
  it('中间：温柔年上 + ISFJ → 0.55', () => {
    const c = { archetype: 'gentle' as const, loveStyle: '温柔年上', mbti: 'ISFJ' };
    expect(herShare(c)).toBe(0.55);
    expect(herShareTier(c)).toBe('balanced');
  });
  it('不认识的恋爱类型 / MBTI 不炸，回落家族', () => {
    expect(herShare({ archetype: 'sharp', loveStyle: '不存在的类型', mbti: 'XXXX' })).toBe(0.45);
  });
  it('掷硬币按分量', () => {
    const devoted = { archetype: 'gentle' as const, loveStyle: '病娇（尺度内）' };
    const cool = { archetype: 'ceo' as const, loveStyle: '冷静大人' };
    expect(rollAboutHer(devoted, 0.85)).toBe(true);
    expect(rollAboutHer(cool, 0.3)).toBe(false);
    expect(rollAboutHer(cool, 0.2)).toBe(true);
  });
});
