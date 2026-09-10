/**
 * TA 身边的人（D-110）：第一次查 TA 的手机时生成一次（通讯录 + 和其中几个人的近期聊天），之后固定不变。
 * 模型写（content/prompts/circle.ts）；AI 不可用 / 写不成回落各语言的通用圈子——手机里不能只有她一个人。
 * 生成后：记事本 / 发帖 / 亲密聊天的 prompt 带【你身边的人】，X 里由他们来评论（lib/posts.ts）。
 */

import { buildCircleSystem, buildCircleUserPrompt, parseCircleJSON, CIRCLE_MAX, CIRCLE_CHATS } from '@/content/prompts';
import { completeText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { getLang, type Lang } from '@/lib/i18n';
import type { Bond, CircleLine, CirclePerson } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

const inflight = new Set<string>();

/** 通用圈子（写不成时的回落）：名字按语言，关系与聊天模板各一套 */
const FALLBACK: Record<Lang, { people: { name: string; relation: string; note: string }[]; chats: Record<string, string[]> }> = {
  zh: {
    people: [
      { name: '妈', relation: '妈妈', note: '隔三差五打电话问吃了没' },
      { name: '阿哲', relation: '发小', note: '从小一起长大，损友' },
      { name: '林姐', relation: '同事', note: '总替我挡事的前辈' },
      { name: '小周', relation: '室友', note: '夜猫子，冰箱常被他扫空' },
    ],
    chats: {
      妈: ['周末回来吃饭吗', '看情况，这周有点忙', '忙也要吃饭，给你炖汤', '知道了，我尽量'],
      阿哲: ['晚上打球？', '不去，累', '你最近怎么老没空', '下周，说好了'],
      林姐: ['明天的东西我先看一遍', '好，谢了林姐', '别熬太晚', '嗯，马上收工'],
    },
  },
  en: {
    people: [
      { name: 'Mom', relation: 'mother', note: 'calls every few days to ask if I ate' },
      { name: 'Jay', relation: 'childhood friend', note: 'grew up together, my worst influence' },
      { name: 'Nora', relation: 'coworker', note: 'the senior who keeps covering for me' },
      { name: 'Sam', relation: 'roommate', note: 'night owl, empties the fridge' },
    ],
    chats: {
      Mom: ['Coming home for dinner this weekend?', 'Maybe, busy week', 'Busy people still eat. Making soup', 'Okay, I will try'],
      Jay: ['Ball tonight?', 'Nah, wiped', 'You have been "wiped" for weeks', 'Next week. Promise'],
      Nora: ['I will look over tomorrow\'s stuff first', 'Thanks Nora', 'Do not stay up too late', 'Wrapping up now'],
    },
  },
  ja: {
    people: [
      { name: '母', relation: '母', note: '数日おきに「ちゃんと食べてる？」と電話してくる' },
      { name: 'ユウ', relation: '幼なじみ', note: '小さい頃から一緒、悪友' },
      { name: '林さん', relation: '同僚', note: 'いつもかばってくれる先輩' },
      { name: 'ショウ', relation: 'ルームメイト', note: '夜型で、冷蔵庫をよく空にする' },
    ],
    chats: {
      母: ['週末ごはん食べに帰ってくる？', 'たぶん。今週ちょっと忙しい', '忙しくても食べなさい。スープ作るから', 'わかった、なるべく'],
      ユウ: ['今夜バスケ行く？', '無理、疲れた', '最近ずっと「疲れた」じゃん', '来週。約束'],
      林さん: ['明日の資料、先に目通しとくね', '助かります', '夜更かししないでね', 'はい、もう切り上げます'],
    },
  },
  ko: {
    people: [
      { name: '엄마', relation: '엄마', note: '며칠에 한 번씩 밥 먹었냐고 전화하심' },
      { name: '재우', relation: '소꿉친구', note: '어릴 때부터 같이 큰 악우' },
      { name: '수진 선배', relation: '직장 동료', note: '늘 대신 막아 주는 선배' },
      { name: '민호', relation: '룸메이트', note: '올빼미형, 냉장고를 자주 비움' },
    ],
    chats: {
      엄마: ['주말에 밥 먹으러 올 거야?', '봐서요, 이번 주 좀 바빠요', '바빠도 밥은 먹어야지. 국 끓여 놓을게', '네, 최대한 갈게요'],
      재우: ['저녁에 농구?', '안 가, 피곤해', '너 요즘 맨날 피곤하대', '다음 주. 약속'],
      '수진 선배': ['내일 자료 내가 먼저 볼게', '고마워요 선배', '너무 늦게까지 하지 마', '네, 곧 정리할게요'],
    },
  },
};

function fallbackCircle(lang: Lang): { circle: CirclePerson[]; chats: Record<string, CircleLine[]> } {
  const pack = FALLBACK[lang];
  const now = Date.now();
  const circle: CirclePerson[] = pack.people.map((p) => ({ id: uid('cp'), ...p }));
  const chats: Record<string, CircleLine[]> = {};
  for (const p of circle) {
    const lines = pack.chats[p.name];
    if (!lines) continue;
    chats[p.id] = lines.map((text, i) => ({
      from: i % 2 === 0 ? 'them' : 'him',
      text,
      at: now - (lines.length - i) * 6 * 60_000 - 3600_000 * (1 + Object.keys(chats).length),
    }));
  }
  return { circle, chats };
}

/** 有圈子就直接返回；没有就生成（模型 → 回落通用圈子）。返回生成后的圈子。 */
export async function ensureCircle(bondId: string): Promise<CirclePerson[]> {
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  if (!bond) return [];
  if (bond.circle?.length) return bond.circle;
  if (inflight.has(bondId)) return [];
  inflight.add(bondId);
  try {
    const built = (await generateCircle(bond)) ?? fallbackCircle(getLang());
    useAppStore.getState().setCircle(bondId, built.circle, built.chats);
    return built.circle;
  } finally {
    inflight.delete(bondId);
  }
}

async function generateCircle(bond: Bond): Promise<{ circle: CirclePerson[]; chats: Record<string, CircleLine[]> } | null> {
  const character = findCharacter(bond.characterId);
  if (!character) return null;
  const { posts } = useAppStore.getState();
  try {
    const raw = await completeText(
      buildCircleSystem(character, bond),
      buildCircleUserPrompt({
        recentNotes: (bond.notes ?? []).slice(-4).map((n) => n.text),
        recentPosts: posts.filter((p) => p.characterId === character.id).slice(-3).map((p) => p.text),
      }),
      900
    );
    const parsed = parseCircleJSON(raw);
    if (!parsed) return null;
    const circle: CirclePerson[] = parsed.people.slice(0, CIRCLE_MAX).map((p) => ({ id: uid('cp'), ...p }));
    const chats: Record<string, CircleLine[]> = {};
    const now = Date.now();
    let n = 0;
    for (const chat of parsed.chats) {
      const person = circle.find((p) => p.name === chat.name);
      if (!person || chats[person.id] || n >= CIRCLE_CHATS) continue;
      n++;
      chats[person.id] = chat.lines.map((l, i) => ({
        from: l.from === 'me' ? 'him' : 'them',
        text: l.text,
        at: now - (chat.lines.length - i) * 5 * 60_000 - n * 5400_000,
      }));
    }
    return { circle, chats };
  } catch (e) {
    console.warn('[circle] 身边的人没写成，用通用圈子：', e);
    return null;
  }
}
