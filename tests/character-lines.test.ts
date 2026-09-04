/**
 * TA 自己的台词（D-094）：解析与校验；scriptFor 用角色自己的台词覆盖原型兜底。
 */
import { describe, expect, it } from 'vitest';

import '@/features';

import { scriptFor } from '@/content/characters';
import { parseCharacterLines } from '@/lib/character-lines';
import type { Character } from '@/lib/types';

const base: Character = {
  id: 'c-lines',
  name: '林知夏',
  archetype: 'sharp',
  loveTag: 'female',
  identity: '建筑系研究生',
  hook: '',
  intro: '',
  tags: [],
  adoptedCount: 0,
  color: '#000',
  colorSoft: '#fff',
  custom: true,
  lang: 'zh',
};

describe('parseCharacterLines', () => {
  it('取 JSON、去空、剥舞台提示、限条数', () => {
    const raw = `好的，这是台词：\n{"opening": ["（抬头）学姐。", "", "刚画完一张图，你来得正好。", "多余的第四条"],
      "offer": ["我不太会说这种话。", "但我想试试。", "你愿意吗？"],
      "arrival": ["嗯。", "今天导师又改了我的方案。", "你呢，今天怎么样？"],
      "persona": "林知夏，24 岁，建筑系研究生，嘴硬心软。", "pursuit": "傲娇式：先否认，再用行动补上。"}`;
    const lines = parseCharacterLines(raw)!;
    expect(lines.opening).toEqual(['学姐。', '刚画完一张图，你来得正好。', '多余的第四条']);
    expect(lines.offer).toHaveLength(3);
    expect(lines.arrival[0]).toBe('嗯。');
    expect(lines.persona).toContain('林知夏');
  });
  it('三组缺一组就算失败；不是 JSON 也失败', () => {
    expect(parseCharacterLines('{"opening": ["a"], "offer": [], "arrival": ["b"]}')).toBeNull();
    expect(parseCharacterLines('抱歉，我写不了')).toBeNull();
  });
});

describe('scriptFor 用角色自己的台词', () => {
  it('没有台词时回落原型兜底', () => {
    expect(scriptFor(base).opening[0]).toBe('哦，你就是那个……算了，进来聊。');
  });
  it('有台词时逐项覆盖，空的仍回落', () => {
    const c: Character = {
      ...base,
      lines: { opening: ['学姐。', '', '  '], offer: ['我想和你在一起。'], arrival: ['嗯。', '今天很累。'], persona: '林知夏，嘴硬心软。' },
    };
    const s = scriptFor(c);
    expect(s.opening).toEqual(['学姐。']);
    expect(s.offer).toEqual(['我想和你在一起。']);
    expect(s.arrival.map((a) => a.text)).toEqual(['嗯。', '今天很累。']);
    expect(s.persona).toBe('林知夏，嘴硬心软。');
    // 没给的追法回落原型
    expect(s.pursuit).toContain('竹马式');
  });
});
