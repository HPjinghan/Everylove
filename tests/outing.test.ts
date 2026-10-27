/**
 * 跑团式外出（D-254）：按说话人分行 / 拆回说话人 / 安静的地方算不算出声 / 营业与时段 / 这会儿谁在 / 多人场的主持人 prompt。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '@/features';

import { buildChatSystemPrompt, placeRuleLines } from '@/content/prompts';
import { PLACES, placeById } from '@/content/places';
import { speakerSegments } from '@/lib/engine';
import { spokeAloud, toSceneMessage } from '@/lib/outing';
import { dayPartOf, isOpen, presenceAt, sceneFor } from '@/lib/presence';
import type { ChatMessage, EngineContext } from '@/lib/types';
import { useAppStore } from '@/store/app-store';
import { custom, me, NOW, seed } from './fixtures';

const him = (text: string): ChatMessage => ({ id: 'm', from: 'him', kind: 'text', text, at: 0 });

beforeEach(() => {
  useAppStore.getState().resetAll();
});

describe('按说话人分行', () => {
  it('旁白、纸条、名字各开一段；没记号的行接在上一段', () => {
    const out = speakerSegments('（推了推眼镜）嗯，来了。\n旁白：管理员抬头看了一眼。\n纸条：别出声\n沈之言（纸条）：写给你的\n接着写', ['沈之言']);
    expect(out).toEqual(['（推了推眼镜）嗯，来了。', '旁白：管理员抬头看了一眼。', '纸条：别出声', '沈之言（纸条）：写给你的 接着写']);
  });

  it('拆回说话人：旁白 / 一人场的纸条 / 多人场的名字与纸条', () => {
    const names = { 沈之言: 'a', 江野: 'b' };
    expect(toSceneMessage(him('旁白：下雨了'), names)).toMatchObject({ speaker: 'narrator', text: '下雨了' });
    expect(toSceneMessage(him('纸条：别出声'), names, 'a')).toMatchObject({ note: true, text: '别出声' });
    const solo = toSceneMessage(him('沈之言：你好'), names, 'a');
    expect(solo.text).toBe('你好');
    expect(solo.speaker).toBeUndefined();
    expect(toSceneMessage(him('江野（纸条）：笨蛋'), names)).toMatchObject({ speaker: 'b', speakerName: '江野', note: true, text: '笨蛋' });
    expect(toSceneMessage(him('等一下：你看'), names).text).toBe('等一下：你看');
  });

  it('安静的地方：只有括号里的动作不算出声', () => {
    expect(spokeAloud('（悄悄比了个手势）')).toBe(false);
    expect(spokeAloud('(She passes a note: "hi")')).toBe(false);
    expect(spokeAloud('（小声）你也来啦')).toBe(true);
  });
});

describe('营业、时段与在场的人', () => {
  it('营业时间跨过午夜；时段；打烊用关门的样子', () => {
    const at = (h: number) => new Date(2026, 9, 27, h, 30);
    const bookstore = placeById('bookstore')!;
    expect(isOpen(bookstore, at(1))).toBe(true);
    expect(isOpen(bookstore, at(3))).toBe(false);
    expect(dayPartOf(at(8))).toBe('morning');
    expect(dayPartOf(at(23))).toBe('night');
    const cafe = placeById('cafe')!;
    expect(sceneFor(cafe, at(23))).toBe(cafe.closedScene ?? cafe.scene);
  });

  it('十二个地点都有规矩、容量与现成动作', () => {
    expect(PLACES).toHaveLength(12);
    for (const p of PLACES) {
      expect(['duo', 'group', 'quiet', 'cinema']).toContain(p.rule);
      expect(p.capacity).toBeGreaterThan(0);
      expect(p.actions.length).toBeGreaterThan(0);
    }
  });

  it('这会儿谁在：同一个小时里稳定，不超过容量，只在开着的地方', () => {
    const d = new Date(2026, 9, 27, 15, 10);
    const a = presenceAt(d);
    expect(presenceAt(new Date(2026, 9, 27, 15, 50))).toEqual(a);
    for (const [id, people] of Object.entries(a)) {
      const place = placeById(id)!;
      expect(isOpen(place, d)).toBe(true);
      expect(people.length).toBeLessThanOrEqual(place.capacity);
      expect(people.every((p) => !p.known)).toBe(true); // 还没有羁绊，全是陌生人
    }
  });
});

describe('多人场的主持人', () => {
  it('人设都在【People here】里，没有一人场的「你是谁」；安静的地方带规矩', () => {
    const ctx: EngineContext = {
      character: seed,
      mode: 'scene',
      me,
      cast: [
        { characterId: seed.id, name: '沈之言', identity: seed.identity, persona: '温润的讲师。', knows: { stage: 'starting to care', nickname: '小满', memory: ['她怕黑'] } },
        { characterId: custom.id, name: custom.name, identity: custom.identity, persona: '嘴硬心软。' },
      ],
      outing: { placeName: '图书馆自习室', scene: '长桌、台灯、「请保持安静」。', kind: 'group', rule: 'quiet', npc: '图书管理员', strikes: 1 },
      history: [],
      userText: '（坐下）',
    };
    const sys = buildChatSystemPrompt(ctx, NOW);
    expect(sys).toMatchSnapshot();
    expect(sys).not.toContain('[Who you are]');
    expect(sys).toContain('[People here]');
    expect(sys).toContain("Doesn't know her");
    expect(placeRuleLines(ctx.outing, true).join('\n')).toContain('shushed 1 time');
  });
});
