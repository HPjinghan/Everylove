/**
 * 查手机（D-242）：通话记录 / TA 的相册 / 合影壁纸 / 上次看过之后新的 / 察觉的概率 / 备注名 / 生成类 prompt 不默认她是恋人。
 */
import { describe, expect, it } from 'vitest';

import '@/features';

import { buildCircleSystem, buildHerContactNameSystem, buildPhoneNoticedUser, circleBlock, parseHerContactName, phoneBlock } from '@/content/prompts';
import { passcodeWillingChance, passcodeWillingToday } from '@/lib/phone';
import { callLog, herContactName, hisPhotos, hisWallpaper, newSince, noticeChance } from '@/lib/his-phone';
import type { AlbumShot, Bond, EngineContext } from '@/lib/types';
import { bondBase, history, NOW, seed } from './fixtures';

const T = NOW.getTime();
const BR = String.fromCharCode(10);
const DAY = 86_400_000;

const bond = (patch: Partial<Bond> = {}): Bond =>
  ({ id: 'b1', characterId: seed.id, messages: [], unread: 0, ...bondBase, ...patch }) as Bond;

describe('TA 的手机里的东西', () => {
  it('通话记录：只认挂断留下的「📞 m:ss」，新的在前', () => {
    const msgs = history([
      ['system', '📞 3:05'],
      ['me', '📞 1:00'],
      ['system', '你看了 TA 的手机'],
      ['system', '📞 0:42'],
    ]);
    expect(callLog(msgs).map((c) => c.duration)).toEqual(['0:42', '3:05']);
  });

  it('相册：外出的拍立得 + TA 发给她的照片（洗好的），新的在前', () => {
    const album: AlbumShot[] = [
      { id: 'p1', uri: 'a.jpg', at: T - 3 * DAY, characterId: seed.id },
      { id: 'p2', uri: 'other.jpg', at: T, characterId: 'someone-else' },
    ];
    const messages = [
      { id: 'm1', from: 'him', kind: 'image', text: '', imageUri: 'sent.jpg', at: T - DAY },
      { id: 'm2', from: 'him', kind: 'image', text: '照片冲洗中…', at: T - 1000 },
      { id: 'm3', from: 'me', kind: 'image', text: '', imageUri: 'hers.jpg', at: T - 2000 },
    ] as Bond['messages'];
    expect(hisPhotos(bond({ messages }), album).map((p) => p.uri)).toEqual(['sent.jpg', 'a.jpg']);
  });

  it('壁纸：LV4 起最近的一张合影；拍 TA 的那张不算（旧存档按手写字猜）', () => {
    const album: AlbumShot[] = [
      { id: 'p1', uri: 'solo.jpg', at: T - DAY, characterId: seed.id, placeId: 'cafe', caption: '沈之言 · 咖啡馆' },
      { id: 'p2', uri: 'old-together.jpg', at: T - 2 * DAY, characterId: seed.id, placeId: 'cafe', caption: '和沈之言的合影 · 咖啡馆' },
      { id: 'p3', uri: 'new-solo.jpg', at: T, characterId: seed.id, placeId: 'park', caption: 'whatever', together: false },
    ];
    const names = ['沈之言'];
    expect(hisWallpaper(bond({ affinity: 160 }), album, names, T)).toBeUndefined();
    // LV4：XP 累计 600 且缔结满 7 天
    expect(hisWallpaper(bond({ affinity: 700 }), album, names, T)).toBe('old-together.jpg');
    expect(hisWallpaper(bond({ affinity: 700, createdAt: T - 2 * DAY }), album, names, T)).toBeUndefined();
  });

  it('新的：第一次看不标；之后只标上次合上之后有的', () => {
    const b = bond({
      circleChats: { a: [{ from: 'them', text: '吃了吗', at: T - 10 }], c: [{ from: 'him', text: '嗯', at: T - DAY }] },
      notes: [
        { id: 'n1', text: '旧的', at: T - DAY },
        { id: 'n2', text: '新的', at: T - 10 },
      ],
    });
    const photos = [{ id: 'x', uri: 'x', at: T - 5 }];
    expect(newSince(b, photos, undefined).chats.size).toBe(0);
    const fresh = newSince(b, photos, T - 3600_000);
    expect([...fresh.chats]).toEqual(['a']);
    expect([...fresh.notes]).toEqual(['n2']);
    expect(fresh.photos).toBe(1);
  });

  it('察觉：TA 给的密码第一次不掷；猜开的、平常、冷却、已在路上', () => {
    expect(noticeChance({}, true, T)).toBe(0);
    expect(noticeChance({}, false, T)).toBe(0.25);
    expect(noticeChance({ phoneGuessed: true }, true, T)).toBe(0.5);
    expect(noticeChance({ phoneGuessed: true, phoneCaught: T - 2 * DAY }, false, T)).toBe(0.25);
    expect(noticeChance({ phoneCaught: T - 3600_000 }, false, T)).toBe(0);
    expect(noticeChance({ phoneNotice: { looked: [], dueAt: T } }, false, T)).toBe(0);
  });

  it('备注名：没写成用昵称；解析去引号取第一行', () => {
    expect(herContactName(bond())).toBe('小满');
    expect(herContactName(bond({ herContact: { name: '小满🌙', level: 2 } }))).toBe('小满🌙');
    expect(parseHerContactName('「截稿战士」\n解释')).toBe('截稿战士');
    expect(parseHerContactName('   ')).toBeNull();
  });
});

describe('生成类 prompt：她是你的谁按羁绊阶段（D-242）', () => {
  it('刚缔结 = 刚交换联系方式，不说恋人', () => {
    const fresh = buildCircleSystem(seed, { ...bondBase, affinity: 0 });
    expect(fresh).toContain('刚交换联系方式、还在互相了解的人');
    expect(fresh).not.toContain('恋人');
  });

  it('备注名与察觉的 prompt', () => {
    expect(buildHerContactNameSystem(seed, bondBase, '小满')).toMatchSnapshot();
    expect(buildPhoneNoticedUser({ nickname: '小满', looked: ['your notebook', 'your chat with 老周'], guessed: true })).toMatchSnapshot();
  });
});

describe('密码给不给（D-244）：一天一个答案，按等级 × 分量', () => {
  it('概率随等级走，分量调一档，LV6 必给', () => {
    expect(passcodeWillingChance(1, 'balanced')).toBe(0.15);
    expect(passcodeWillingChance(1, 'independent')).toBe(0.05);
    expect(passcodeWillingChance(3, 'devoted')).toBeCloseTo(0.65);
    expect(passcodeWillingChance(6, 'independent')).toBeCloseTo(0.85);
    expect(passcodeWillingChance(6, 'balanced')).toBe(1);
  });

  it('同一天同一个答案；LV1 大多数日子不给', () => {
    const at = (d: number) => T + d * DAY;
    expect(passcodeWillingToday('4821', 1, 'balanced', at(0))).toBe(passcodeWillingToday('4821', 1, 'balanced', at(0) + 3600_000));
    const yes = Array.from({ length: 200 }, (_, d) => passcodeWillingToday('4821', 1, 'balanced', at(d))).filter(Boolean).length;
    expect(yes).toBeGreaterThan(10);
    expect(yes).toBeLessThan(60);
  });

  it('不给的那天 prompt 里没有密码', () => {
    const ctx = (code: string) => ({ mode: 'bonded', character: seed, bond: { ...bondBase, affinity: 0, phoneCode: code }, history: [], userText: '' }) as EngineContext;
    const codes = Array.from({ length: 40 }, (_, i) => String(1000 + i));
    const refused = codes.find((c) => !passcodeWillingToday(c, 1, 'balanced', T))!;
    const lines = phoneBlock(ctx(refused), NOW);
    expect(lines.join(BR)).not.toContain(refused);
    expect(lines).toMatchSnapshot();
  });

  it('身边的人：对她说话时提醒她一个都没见过', () => {
    const circle = [{ id: 'p1', name: '老周', relation: '同事' }];
    expect(circleBlock(circle, true).join(BR)).toContain('She has never met any of them');
    expect(circleBlock(circle).join(BR)).not.toContain('She has never met');
  });
});
