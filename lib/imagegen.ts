/**
 * 图像生成：Qwen 文生图，走百度千帆 v2 同步接口（与聊天共用一把千帆 key，D-014）。
 * 两个用途：
 * 1. 初见甩图——广场试聊他不说话，每轮回一格漫画，四轮构成初遇叙事；
 * 2. 羁绊漫画显影——亲密度里程碑时他送来一格（剧情语法送达）。
 * 红线约束写死在 prompt：用户 POV 不入镜、暧昧合规、不做真人。
 * 生成图下载到本机（图片 URL 24 小时过期，相册是资产不能丢）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { scriptFor } from '@/content/characters';
import { generateReply, resolveKey } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { Bond, Character, ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

export const QIANFAN_IMAGE_MODEL = process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || 'qwen-image';

function imageKey(): string {
  return resolveKey('qianfan', { qianfan: useAppStore.getState().qianfanKey });
}

/** 有千帆 key 即可出图（聊天与图像共用） */
export function imageKeyReady(): boolean {
  return Boolean(imageKey());
}

/** 千帆同步文生图，下载到本机后返回本地 URI */
async function generateImage(prompt: string): Promise<string> {
  const key = imageKey();
  if (!key) throw new Error('no qianfan key');
  const res = await fetch('https://qianfan.baidubce.com/v2/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: QIANFAN_IMAGE_MODEL, prompt, size: '1024x1024', n: 1 }),
  });
  if (!res.ok) throw new Error(`Qianfan image ${res.status}`);
  const data = (await res.json()) as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('no image url');

  const dir = `${FileSystem.documentDirectory}comics/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const local = `${dir}${uid('img')}.jpg`;
  // 千帆返回 http 的 BOS 地址，iOS ATS 只放行 https
  const dl = await FileSystem.downloadAsync(url.replace(/^http:/, 'https:'), local);
  return dl.uri;
}

const COMIC_STYLE =
  '女性向少女漫画单格插画，日系条漫风格，柔和线条，浅色水彩质感，米白底玫瑰粉点缀。';

/**
 * 核心构图（D-015）：画的是「你们俩正在相处」的场景，但她不出镜——
 * 第一人称 POV，观者即是她；画面里看得见的人只有他，他单方面转头看向镜头（看向她）。
 */
const COMIC_POV =
  '画面内容是你们两个人正在一起相处的场景，但「她」绝对不出镜：第一人称 POV 构图，镜头就是她的眼睛。' +
  '画面里看得见的人只有他一个——不出现她的身体、手、头发倒影或任何第二个人物。' +
  '他正处在你们共同所在的场景里，转过头来看向镜头（看着她的眼睛）说话。';

const COMIC_RULES =
  '氛围暧昧、温柔、克制，无露骨内容。不模仿任何真实人物长相。';

function characterLine(character: Character): string {
  const script = scriptFor(character);
  return `他是：${character.name}，${character.identity}，${character.styleLabel ?? ''}，气质：${script.persona}`;
}

function dialogDigest(messages: ChatMessage[], character: Character): string {
  return messages
    .filter((m) => m.kind === 'text' && m.from !== 'system')
    .slice(-8)
    .map((m) => `${m.from === 'me' ? '她' : character.name}：${m.text}`)
    .join('\n');
}

/** 初见四格的镜头递进（第 1-4 轮）：同一段相处，距离一格比一格近 */
const SQUARE_BEATS = [
  '第一格镜头：你们刚搭上话，他还隔着一点客气的距离，闻声转过头来，眼神里有一点被勾起的兴趣。',
  '第二格镜头：你们聊开了，他一边做着手里的事，一边因为她这句话侧过头来接话，神态放松了。',
  '第三格镜头：距离更近的半身构图，他转头看她时目光停留得更久，嘴角有克制的笑意。',
  '第四格镜头：心动瞬间的近景，他忽然认真地转头直视镜头说出这句话，空气安静了一拍。',
];

function buildSquarePanelPrompt(
  character: Character,
  turn: number,
  history: ChatMessage[],
  userText: string,
  hisLine: string
): string {
  return [
    COMIC_STYLE,
    characterLine(character),
    COMIC_POV,
    `你们此刻在一起做什么、身处什么场景，从这段对话推断（结合他的身份）：\n${dialogDigest(history, character)}\n她：${userText}`,
    SQUARE_BEATS[Math.min(Math.max(turn, 1), SQUARE_BEATS.length) - 1],
    `画面里有一个漫画对话气泡从他那里说出，气泡里的中文台词一字不差地写：「${hisLine}」。除气泡台词外画面内不出现其他文字。`,
    COMIC_RULES,
  ].join('\n');
}

/**
 * 初见甩图：广场试聊的一轮回复——他不发文字，直接一格漫画（D-014/D-015）：
 * 先用对话引擎生成他这句话，再把「你们的相处 + 他转头对你说这句话」画进格子里。
 * 成功返回 true；失败返回 false（调用方回落文字引擎）。
 */
export async function deliverSquarePanel(
  characterId: string,
  userText: string,
  turn: number
): Promise<boolean> {
  const character = findCharacter(characterId);
  if (!character) return false;
  try {
    const { engine, anthropicKey, qianfanKey, squareChats } = useAppStore.getState();
    const history = squareChats[characterId]?.messages ?? [];
    const reply = await generateReply(
      { character, mode: 'square', history, userText },
      engine,
      { anthropic: anthropicKey, qianfan: qianfanKey }
    );
    const hisLine = reply.texts[0] ?? '';
    const imageUri = await generateImage(
      buildSquarePanelPrompt(character, turn, history, userText, hisLine)
    );
    useAppStore.getState().appendSquare(characterId, [
      { id: uid('m'), from: 'him', kind: 'image', text: '', imageUri, at: Date.now() },
    ]);
    return true;
  } catch (e) {
    console.warn('[imagegen] 初见甩图失败，回落文字：', e);
    return false;
  }
}

/** 羁绊漫画：把你们最近的相处画成一格（同一套 POV 构图，台词他在会话里说了，画面不用气泡） */
function buildBondComicPrompt(character: Character, bond: Bond): string {
  return [
    COMIC_STYLE,
    characterLine(character),
    COMIC_POV,
    `你们此刻在一起做什么、身处什么场景，从你们最近的相处推断：\n${dialogDigest(bond.messages, character)}`,
    '画面内不出现文字和对话框。',
    COMIC_RULES,
  ].join('\n');
}

/**
 * 「给你讲个故事吧」：他先说一句，再把生成好的漫画送进会话流。
 * 没配 key 或生成失败时静默放弃（warn），不打断聊天。
 */
export async function deliverComic(bondId: string): Promise<boolean> {
  if (!imageKeyReady()) {
    console.warn('[imagegen] 没有千帆 key，跳过漫画显影');
    return false;
  }
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  const character = bond && findCharacter(bond.characterId);
  if (!bond || !character) return false;

  useAppStore.getState().appendBond(bondId, [
    {
      id: uid('m'),
      from: 'him',
      kind: 'text',
      text: `${bond.nickname}，给你画了点东西。等我一下。`,
      at: Date.now(),
    },
  ]);

  try {
    const imageUri = await generateImage(buildBondComicPrompt(character, bond));
    useAppStore.getState().appendBond(
      bondId,
      [
        {
          id: uid('m'),
          from: 'him',
          kind: 'image',
          text: '——刚才聊着聊着，脑子里就有了这个画面。',
          imageUri,
          at: Date.now(),
        },
      ],
      { affinityDelta: 2, unreadDelta: 1 }
    );
    return true;
  } catch (e) {
    console.warn('[imagegen] 漫画生成失败：', e);
    return false;
  }
}
