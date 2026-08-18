/**
 * 图像生成：Qwen 文生图 / 图像编辑，走百度千帆 v2 同步接口（与聊天共用一把千帆 key，D-014）。
 * 三个用途：
 * 1. 立绘——捏＋时生成一次（或开发者面板为种子角色生成），存本机，作为后续所有生图的参考图（D-019）；
 * 2. 初见甩图——广场试聊 TA 不说话，每轮回一格漫画，四轮构成初遇叙事；
 * 3. 羁绊漫画显影——亲密度里程碑时 TA 送来一格（剧情语法送达）。
 * 有立绘时，2/3 走「图像编辑」接口（qwen-image-edit，参考图 = 立绘），人物在不同画面间保持一致；
 * 没有立绘（或编辑失败）回落文生图（qwen-image，只靠外貌文字 look）。
 * 红线约束写死在 prompt：用户 POV 不入镜、暧昧合规、不做真人。
 * 生成图下载到本机（图片 URL 24 小时过期，相册是资产不能丢）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import {
  buildBondComicPrompt,
  buildPortraitPrompt,
  buildSquarePanelPrompt,
  COMIC_CAPTION,
  COMIC_INTRO_LINE,
} from '@/content/prompts';
import { generateReply, resolveKey } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

export const QIANFAN_IMAGE_MODEL = process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || 'qwen-image';
/** 参考图编辑模型（立绘 → 新画面）。千帆 v2 /images/edits，接受 base64 data URI */
export const QIANFAN_IMAGE_EDIT_MODEL =
  process.env.EXPO_PUBLIC_QIANFAN_IMAGE_EDIT_MODEL || 'qwen-image-edit';

/**
 * 种子角色是否自动生成立绘（首次进入试聊时后台生成一张）。
 * 默认关：种子角色「试装无立绘、美术预算集中给相册」是既有产品口径，是否用生成立绘替代属产品决定
 * （OPEN_QUESTIONS #14）。开发者面板可手动为种子角色生成立绘试效果。
 */
export const SEED_PORTRAITS_AUTO = false;

function imageKey(): string {
  return resolveKey('qianfan', { qianfan: useAppStore.getState().qianfanKey });
}

/** 有千帆 key 即可出图（聊天与图像共用） */
export function imageKeyReady(): boolean {
  return Boolean(imageKey());
}

async function downloadTo(url: string, subdir: string, name: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}${subdir}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const local = `${dir}${name}.jpg`;
  // 千帆返回 http 的 BOS 地址，iOS ATS 只放行 https
  const dl = await FileSystem.downloadAsync(url.replace(/^http:/, 'https:'), local);
  return dl.uri;
}

/** 千帆同步文生图，下载到本机后返回本地 URI */
async function generateImage(prompt: string, subdir = 'comics'): Promise<string> {
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
  return downloadTo(url, subdir, uid('img'));
}

/**
 * 千帆图像编辑：以本机图片为参考（读成 base64 data URI），按 prompt 生成新画面（D-019）。
 * 实测：人物外貌/穿着能跟参考图保持一致，场景与动作按 prompt 变化。
 */
async function editImage(referenceUri: string, prompt: string, subdir = 'comics'): Promise<string> {
  const key = imageKey();
  if (!key) throw new Error('no qianfan key');
  const b64 = await FileSystem.readAsStringAsync(referenceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const res = await fetch('https://qianfan.baidubce.com/v2/images/edits', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: QIANFAN_IMAGE_EDIT_MODEL,
      image: `data:image/jpeg;base64,${b64}`,
      prompt,
    }),
  });
  if (!res.ok) throw new Error(`Qianfan image edit ${res.status}`);
  const data = (await res.json()) as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('no image url');
  return downloadTo(url, subdir, uid('img'));
}

// 全部生图 prompt（画风 / POV / 镜头 / 拼装）都在 content/prompts.ts（D-017）

/* ────────────────────────────── 立绘（D-019） ────────────────────────────── */

/** 当前角色的立绘本机 URI（没有则 undefined） */
export function portraitFor(characterId: string): string | undefined {
  return useAppStore.getState().portraits[characterId];
}

/** 只生成、不入库：捏＋预览用（角色还没创建，先看一眼、可重生成） */
export async function generatePortraitFor(character: Character): Promise<string> {
  return generateImage(buildPortraitPrompt(character), 'portraits');
}

const portraitInflight = new Set<string>();

/**
 * 确保某角色有立绘：没有就生成并入库（后台、静默失败）。force=true 重生成。
 * 返回最终的立绘 URI；没 key / 失败返回 undefined。
 */
export async function ensurePortrait(
  characterId: string,
  force = false
): Promise<string | undefined> {
  const existing = portraitFor(characterId);
  if (existing && !force) return existing;
  if (!imageKeyReady() || portraitInflight.has(characterId)) return existing;
  const character = findCharacter(characterId);
  if (!character) return existing;
  portraitInflight.add(characterId);
  try {
    const uri = await generatePortraitFor(character);
    useAppStore.getState().setPortrait(characterId, uri);
    return uri;
  } catch (e) {
    console.warn('[imagegen] 立绘生成失败：', e);
    return existing;
  } finally {
    portraitInflight.delete(characterId);
  }
}

/** 有参考图就走编辑接口，失败或没参考图回落文生图（保证一定能出图或抛错给调用方） */
async function renderPanel(
  characterId: string,
  promptWithRef: string,
  promptWithoutRef: string
): Promise<string> {
  const ref = portraitFor(characterId);
  if (ref) {
    try {
      return await editImage(ref, promptWithRef);
    } catch (e) {
      console.warn('[imagegen] 参考图编辑失败，回落文生图：', e);
    }
  }
  return generateImage(promptWithoutRef);
}

/* ────────────────────────────── 初见甩图 ────────────────────────────── */

/**
 * 初见甩图：广场试聊的一轮回复——TA 不发文字，直接一格漫画（D-014/D-015）：
 * 先用对话引擎生成 TA 这句话，再把「你们的相处 + TA 转头对你说这句话」画进格子里。
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
    const imageUri = await renderPanel(
      characterId,
      buildSquarePanelPrompt(character, turn, history, userText, hisLine, { reference: true }),
      buildSquarePanelPrompt(character, turn, history, userText, hisLine)
    );
    // TA 的台词不上屏（画在气泡里），但要存进 spoken 供上下文：否则 TA 会忘记自己刚说过什么（D-016）
    useAppStore.getState().appendSquare(characterId, [
      { id: uid('m'), from: 'him', kind: 'image', text: '', spoken: hisLine, imageUri, at: Date.now() },
    ]);
    return true;
  } catch (e) {
    console.warn('[imagegen] 初见甩图失败，回落文字：', e);
    return false;
  }
}

/* ────────────────────────────── 羁绊漫画显影 ────────────────────────────── */

/**
 * 「给你讲个故事吧」：TA 先说一句，再把生成好的漫画送进会话流。
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
      text: COMIC_INTRO_LINE(bond.nickname),
      at: Date.now(),
    },
  ]);

  try {
    const imageUri = await renderPanel(
      character.id,
      buildBondComicPrompt(character, bond, { reference: true }),
      buildBondComicPrompt(character, bond)
    );
    useAppStore.getState().appendBond(
      bondId,
      [
        {
          id: uid('m'),
          from: 'him',
          kind: 'image',
          text: COMIC_CAPTION,
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
