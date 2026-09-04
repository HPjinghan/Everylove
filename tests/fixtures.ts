/**
 * 测试夹具：一位种子角色、一位字段填满的自创角色、一份「我」的身份、一段有记忆的羁绊。
 * 时间固定在 2026-09-04 周五 21:30（prompt 里的时间感与「在一起第 N 天」都要确定）。
 */
import { CHARACTERS } from '@/content/characters';
import type { Bond, Character, ChatMessage, EngineContext, UserProfile } from '@/lib/types';

export const NOW = new Date(2026, 8, 4, 21, 30, 0, 0);

export const seed: Character = CHARACTERS[0];

export const custom: Character = {
  id: 'custom-1',
  name: '林知夏',
  archetype: 'sharp',
  loveTag: 'female',
  gender: 'female',
  styleLabel: '傲娇学姐',
  hook: '嘴上说不在乎，转身把你的消息看了三遍。',
  intro: '别误会，我只是顺路。',
  identity: '建筑系研究生 · 24',
  look: '黑色齐肩直发，冷白皮，常穿黑色高领与工装裤',
  pronoun: '她',
  story: '从小在设计院长大，父母都是建筑师，习惯把情绪画进图纸里。',
  race: '人类',
  birthday: '03-08',
  catchphrase: '随你',
  likes: '深夜的工作室、黑咖啡、下雨',
  dislikes: '被催、寒暄、没有逻辑的浪漫',
  loveStyle: '傲娇',
  mbti: 'INTJ',
  chatNotes: '叫她「学姐」她会嘴硬但很受用。',
  schedule: '上午泡图书馆，下午在工作室画图，深夜才回消息',
  adultConfirmed: true,
  presetMemories: '去年冬天你们在图书馆抢过同一个座位\n她借过你一把伞，至今没还',
  initiative: 'low',
  taboos: '不谈她的前任；不评价她的家庭',
  secrets: '她其实早就记住了你的名字\n她偷偷把你的照片设成了草图的参考\n她申请了你所在城市的交换项目',
  artStyle: 'anime',
  offerAfterTurns: 6,
  tags: ['傲娇', '学姐'],
  adoptedCount: 12,
  color: '#6B7FB0',
  colorSoft: '#E4E9F5',
  custom: true,
};

export const me: UserProfile = {
  nickname: '小满',
  gender: 'female',
  pronoun: '她',
  occupation: '插画师',
  orientation: '喜欢女生',
  signature: '最近在赶稿，睡得很晚',
  background: '在杭州独居，养了一只三花猫',
  about: '喜欢逛旧书店，怕黑，不吃香菜',
  boundaries: '别替我安排作息；别问我的家人',
};

export function history(lines: [ChatMessage['from'], string][]): ChatMessage[] {
  return lines.map(([from, text], i) => ({
    id: `m${i}`,
    from,
    kind: from === 'system' ? 'system' : 'text',
    text,
    at: NOW.getTime() - (lines.length - i) * 60_000,
  }));
}

export const bondBase: Pick<Bond, 'name' | 'nickname' | 'affinity' | 'birthday' | 'createdAt' | 'memory'> = {
  name: '沈之言',
  nickname: '小满',
  affinity: 160,
  birthday: '11-02',
  createdAt: NOW.getTime() - 9 * 86_400_000,
  memory: {
    facts: [
      '[她] 她在赶一本绘本的稿子，截稿是 9 月 10 日',
      '[约定] 2026-09-06 周日下午一起去街角咖啡馆',
      '[答应] 沈之言答应带她去看新开的书店',
      '[节点] 2026-08-26 交换联系方式',
      '她怕黑，晚上回家会开着灯睡',
    ],
    summary: '认识后聊得很投缘，她说过工作压力大，他陪她熬过一个截稿夜。',
    summarizedUpTo: 4,
    factsUpTo: 12,
    updatedAt: NOW.getTime(),
  },
};

export const squareCtx: EngineContext = {
  character: seed,
  mode: 'square',
  me,
  history: history([
    ['him', '别急着自我介绍——我们有的是时间。'],
    ['me', '你也是刚下课？'],
    ['him', '嗯，最后一节。你呢，还在画？'],
    ['me', '在赶稿，脑子已经糊了。'],
  ]),
  userText: '你平时下课都去哪儿？',
};

export const squareCustomCtx: EngineContext = {
  ...squareCtx,
  character: custom,
  history: history([['me', '学姐，伞什么时候还我？']]),
  userText: '学姐，伞什么时候还我？',
};

export const bondedCtx: EngineContext = {
  character: seed,
  mode: 'bonded',
  bond: { ...bondBase, phoneCode: '4821', phoneUnlocked: false },
  me,
  history: history([
    ['system', '你们交换了联系方式 · 他开始叫你「小满」'],
    ['him', '到家了吗？'],
    ['me', '刚到，猫在门口等我。'],
  ]),
  userText: '今天好累，想听你说说话。',
};

export const bondedUnlockedCustomCtx: EngineContext = {
  ...bondedCtx,
  character: custom,
  bond: { ...bondBase, name: '林知夏', affinity: 420, phoneCode: '0917', phoneUnlocked: true },
};

export const callCtx: EngineContext = { ...bondedCtx, mode: 'call', userText: '喂？在干嘛呢' };

export const noteCtx: EngineContext = { ...bondedCtx, userText: '（写下今天记事本里的一条。）' };

const outingBase = {
  placeName: '街角咖啡馆',
  scene: '一家安静的街角咖啡馆：木质吧台、暖黄灯光、玻璃柜里有当日的蛋糕。',
  weatherLine: '今天多云，22°C',
};

export const outingDateCtx: EngineContext = {
  character: seed,
  mode: 'outing',
  bond: bondBase,
  me,
  outing: { ...outingBase, kind: 'date', appointment: { atLabel: '9月4日 周五 21:00', lateMinutes: 3 } },
  history: history([['him', '（比约定时间早到了一会儿，看到你，朝你挥手）这里，小满。']]),
  userText: '（小跑过来）等很久了吗？',
};

export const outingLateCtx: EngineContext = {
  ...outingDateCtx,
  outing: { ...outingBase, kind: 'date', appointment: { atLabel: '9月4日 周五 21:00', lateMinutes: 25 } },
};

export const outingEarlyCtx: EngineContext = {
  ...outingDateCtx,
  outing: { ...outingBase, kind: 'date', appointment: { atLabel: '9月4日 周五 22:00', lateMinutes: -30 } },
};

export const outingDateNoTimeCtx: EngineContext = {
  ...outingDateCtx,
  outing: { ...outingBase, kind: 'date' },
};

export const outingEncounterCtx: EngineContext = {
  ...outingDateCtx,
  character: custom,
  bond: { ...bondBase, name: '林知夏', affinity: 60 },
  outing: { ...outingBase, kind: 'encounter' },
};

export const outingStrangerCtx: EngineContext = {
  character: custom,
  mode: 'outing',
  me,
  outing: {
    placeName: '广场',
    scene: '城市中心的开放广场：喷泉的水声、卖气球和烤红薯的摊子。',
    kind: 'stranger',
    weatherLine: '今天多云，22°C',
  },
  history: history([['him', '（在你旁边站了一会儿，终于开口）排这么长的队，应该很好吃吧？']]),
  userText: '应该吧，我也是第一次来。',
};
