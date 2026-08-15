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
import { resolveKey } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { Bond, Character } from '@/lib/types';
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

const COMIC_RULES =
  '第一人称视角构图（观者即她），画面里绝对只有他一个人，不出现第二个人物。' +
  '氛围暧昧、温柔、克制，无露骨内容。不模仿任何真实人物长相。画面内不出现文字和对话框。';

function characterLine(character: Character): string {
  const script = scriptFor(character);
  return `画面唯一人物：${character.name}，${character.identity}，${character.styleLabel ?? ''}，气质：${script.persona}`;
}

/** 初见四格的叙事节拍（第 1-4 轮） */
const SQUARE_BEATS = [
  '这一格：初遇——他刚注意到镜头外的你，微微侧头，眼神里有一点被勾起的兴趣，姿态还带着陌生人的距离。',
  '这一格：回应——他听见了你的话，神态放松了些，身体朝镜头微微倾近，手里还拿着自己正在忙的东西。',
  '这一格：走近——半身构图，距离拉近，他眼里的兴趣藏不住了，嘴角有克制的笑意。',
  '这一格：心动——面部特写，他看向镜头外的你，目光认真起来，空气里有暧昧的停顿。',
];

function buildSquarePanelPrompt(character: Character, turn: number, userText: string): string {
  return [
    COMIC_STYLE,
    characterLine(character),
    SQUARE_BEATS[Math.min(Math.max(turn, 1), SQUARE_BEATS.length) - 1],
    `画面要回应镜头外的她刚说的话：「${userText}」——用他的神态、动作和场景细节回应，不用文字。`,
    COMIC_RULES,
  ].join('\n');
}

/**
 * 初见甩图：广场试聊的一轮回复——不说话，直接一格漫画（D-014）。
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
    const imageUri = await generateImage(buildSquarePanelPrompt(character, turn, userText));
    useAppStore.getState().appendSquare(characterId, [
      { id: uid('m'), from: 'him', kind: 'image', text: '', imageUri, at: Date.now() },
    ]);
    return true;
  } catch (e) {
    console.warn('[imagegen] 初见甩图失败，回落文字：', e);
    return false;
  }
}

/** 羁绊漫画：从角色设定 + 最近对话组一格（POV：画他，不画用户） */
function buildBondComicPrompt(character: Character, bond: Bond): string {
  const recent = bond.messages
    .filter((m) => m.kind === 'text' && m.from !== 'system')
    .slice(-8)
    .map((m) => `${m.from === 'me' ? '她' : character.name}：${m.text}`)
    .join('\n');
  return [
    COMIC_STYLE,
    characterLine(character),
    `场景灵感来自他们最近的对话：\n${recent}`,
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
