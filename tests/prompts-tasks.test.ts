/**
 * 非对话类 prompt 的快照（D-087）：记忆提取 / 外出与记事本并入记忆 / X 发帖与回帖 / 立绘 / 外出拍照 /
 * 看图 / 约定识别 / 看我的手机 / 爽约 / 心跳 / 创造解析。拆分 prompt 目录前先逐字锁定。
 */
import { describe, expect, it } from 'vitest';

import '@/features';

import {
  APPOINTMENT_EXTRACT_SYSTEM,
  buildAppointmentExtractPrompt,
  buildCharacterPostSystem,
  buildCharacterLinesUser,
  buildCharacterPostUserPrompt,
  buildMemoryExtractPrompt,
  buildOutingPhotoPrompt,
  buildPeekMyPhoneUser,
  buildPortraitPrompt,
  buildPostReplySystem,
  buildPostReplyUserPrompt,
  characterLinesSystem,
  characterParseSystem,
  worldParseSystem,
  heartbeatLine,
  imageCaptionSystem,
  IMAGE_CAPTION_USER,
  memoryExtractSystem,
  missedDateUserLine,
  outingMemoryContext,
} from '@/content/prompts';
import { bondBase, custom, history, me, NOW, seed } from './fixtures';

const chat = history([
  ['him', '到家了吗？'],
  ['me', '刚到，猫在门口等我。周五晚上一起去看海吧？'],
  ['him', '好，周五晚上七点海边栈道见。'],
]);

describe('记忆', () => {
  it('提取系统指令（中 / 英）', () => {
    expect(memoryExtractSystem('zh')).toMatchSnapshot();
    expect(memoryExtractSystem('en')).toMatchSnapshot();
  });
  it('常规提取（有旧对话并入摘要）', () => {
    expect(
      buildMemoryExtractPrompt({
        hisName: '沈之言',
        nickname: '小满',
        memory: bondBase.memory!,
        aged: chat.slice(0, 1),
        recent: chat.slice(1),
        today: '2026-09-04 周五',
      })
    ).toMatchSnapshot();
  });
  it('外出并入（赴约迟到）', () => {
    const context = outingMemoryContext({
      placeName: '街角咖啡馆',
      kind: 'date',
      startedAt: NOW.getTime(),
      planAt: NOW.getTime() - 25 * 60_000,
      lateMinutes: 25,
    });
    expect(context).toMatchSnapshot();
    expect(
      buildMemoryExtractPrompt({ hisName: '沈之言', nickname: '小满', memory: bondBase.memory!, aged: [], recent: chat, today: '2026-09-04 周五', context })
    ).toMatchSnapshot();
  });
  it('外出并入（偶遇 / 准时 / 早到）', () => {
    expect([
      outingMemoryContext({ placeName: '城南公园', kind: 'encounter', startedAt: NOW.getTime() }),
      outingMemoryContext({ placeName: '街角咖啡馆', kind: 'date', startedAt: NOW.getTime(), planAt: NOW.getTime(), lateMinutes: 3 }),
      outingMemoryContext({ placeName: '街角咖啡馆', kind: 'date', startedAt: NOW.getTime(), planAt: NOW.getTime(), lateMinutes: -30 }),
      outingMemoryContext({ placeName: '街角咖啡馆', kind: 'date', startedAt: NOW.getTime() }),
    ]).toMatchSnapshot();
  });
});

describe('X', () => {
  it('回帖（有羁绊 / 无羁绊）', () => {
    expect(buildPostReplySystem(seed, bondBase, me)).toMatchSnapshot();
    expect(buildPostReplySystem(custom, undefined, me)).toMatchSnapshot();
    expect(
      buildPostReplyUserPrompt({ postText: '今晚的月亮很圆', comments: [{ from: 'me', text: '在哪看的？' }], hisName: '沈之言' })
    ).toMatchSnapshot();
    expect(buildPostReplyUserPrompt({ postText: '今晚的月亮很圆', comments: [], hisName: '沈之言' })).toMatchSnapshot();
  });
  it('发帖', () => {
    expect(buildCharacterPostSystem(seed, bondBase)).toMatchSnapshot();
    expect(buildCharacterPostSystem(custom, undefined)).toMatchSnapshot();
    expect(buildCharacterPostUserPrompt(NOW)).toMatchSnapshot();
    expect(
      buildCharacterPostUserPrompt(NOW, {
        aboutHer: false,
        recentPosts: ['系里的樱花开了半树。', '今天的茶泡过头了。'],
        recentNotes: ['老周借的那本《陶庵梦忆》还没还我。'],
      })
    ).toMatchSnapshot();
  });
  it('发帖：她的影子出现多少按分量（D-099）', () => {
    expect(buildCharacterPostSystem({ ...seed, loveStyle: '依恋型', mbti: 'INFP' }, bondBase)).toContain('常有她的影子');
    expect(buildCharacterPostSystem({ ...seed, loveStyle: '冷静大人', mbti: 'INTJ' }, bondBase)).toContain('大多数帖子和她无关');
    expect(buildCharacterPostSystem(seed, bondBase)).toContain('可以有你们生活的影子');
  });
});

describe('生图', () => {
  it('立绘（种子角色缺省画风 / 自创角色动漫画风 / 不指定画风）', () => {
    expect(buildPortraitPrompt(seed)).toMatchSnapshot();
    expect(buildPortraitPrompt(custom)).toMatchSnapshot();
    expect(buildPortraitPrompt({ ...custom, artStyle: 'none', race: '龙族', look: undefined })).toMatchSnapshot();
  });
  it('外出拍照（合影 / 拍 TA）', () => {
    const opts = { placeName: '海边栈道', scene: '沿海的木栈道。', weatherLine: '今天多云，22°C' };
    expect(buildOutingPhotoPrompt(seed, { ...opts, kind: 'together', digest: '她：好冷\n主角：把外套给你' })).toMatchSnapshot();
    expect(buildOutingPhotoPrompt(custom, { ...opts, kind: 'solo' })).toMatchSnapshot();
  });
  it('看图（中 / 日 / 韩）', () => {
    expect(imageCaptionSystem('zh')).toMatchSnapshot();
    expect(imageCaptionSystem('ja')).toMatchSnapshot();
    expect(imageCaptionSystem('ko')).toMatchSnapshot();
    expect(IMAGE_CAPTION_USER).toMatchSnapshot();
  });
});

describe('约定与手机', () => {
  it('约定识别', () => {
    expect(APPOINTMENT_EXTRACT_SYSTEM).toMatchSnapshot();
    expect(buildAppointmentExtractPrompt({ hisName: '沈之言', nickname: '小满', recent: chat, now: NOW })).toMatchSnapshot();
  });
  it('爽约那一句', () => {
    expect(missedDateUserLine('街角咖啡馆', '9月4日 周五 15:00')).toMatchSnapshot();
  });
  it('看我的手机', () => {
    expect(
      buildPeekMyPhoneUser({
        nickname: '小满',
        notes: [{ at: NOW.getTime(), text: '今天又没画完\n有点想放弃' }],
        chats: [{ name: '林知夏', messages: chat }],
      })
    ).toMatchSnapshot();
    expect(buildPeekMyPhoneUser({ nickname: '小满', notes: [], chats: [] })).toMatchSnapshot();
  });
});

describe('心跳与创造', () => {
  it('心跳三段', () => {
    expect([0, 1, 2].map((salt) => [
      heartbeatLine('before', '期末考', '小满', salt),
      heartbeatLine('day', '期末考', '小满', salt),
      heartbeatLine('after', '期末考', '小满', salt),
    ])).toMatchSnapshot();
  });
  it('创造描述解析（中 / 英）', () => {
    expect(characterParseSystem('zh')).toMatchSnapshot();
    expect(characterParseSystem('en')).toMatchSnapshot();
  });
  it('世界书描述解析（D-123）', () => {
    expect(worldParseSystem('zh')).toMatchSnapshot();
    expect(worldParseSystem('en')).toMatchSnapshot();
  });
  it('TA 的台词（中 / 日 / 韩）+ 角色卡', () => {
    expect(characterLinesSystem('zh')).toMatchSnapshot();
    expect(characterLinesSystem('ja')).toMatchSnapshot();
    expect(characterLinesSystem('ko')).toMatchSnapshot();
    expect(buildCharacterLinesUser(custom)).toMatchSnapshot();
  });
});
