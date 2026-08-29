/**
 * 图像生成：Qwen 文生图，走百度千帆 v2 同步接口（与聊天共用一把千帆 key，D-014）。
 * D-037 起只剩一个用途：**立绘**——捏＋时生成一次（或开发者面板为种子角色生成），
 * 存本机，作头像与卡面用。会话内生图（初见画面/羁绊画面）已下线：聊天与初见回归纯文本。
 * 红线约束写死在 prompt：暧昧合规、不做真人。
 * 生成图下载到本机（图片 URL 24 小时过期，资产不能丢）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { buildPortraitPrompt } from '@/content/prompts';
// （外出拍照的 prompt 由调用方拼好传入，见 content/prompts.ts 的 buildOutingPhotoPrompt，D-051）
import { resolveKey } from '@/lib/engine';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import { uid } from '@/lib/format';
import type { Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

export const QIANFAN_IMAGE_MODEL = process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || 'qwen-image';

/**
 * 种子角色是否自动生成立绘（首次进入试聊时后台生成一张）。
 * 默认关：种子角色「试装无立绘、美术预算集中给相册」是既有产品口径，是否用生成立绘替代属产品决定
 * （OPEN_QUESTIONS #14）。开发者面板可手动为种子角色生成立绘试效果。
 */
export const SEED_PORTRAITS_AUTO = false;

function imageKey(): string {
  return resolveKey('qianfan', { qianfan: useAppStore.getState().qianfanKey });
}

/** 可出图 = 本地有千帆 key（直连），或已登录（走服务端代理，D-057） */
export function imageKeyReady(): boolean {
  return Boolean(imageKey()) || proxyReadySync();
}

async function downloadTo(url: string, subdir: string, name: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}${subdir}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const local = `${dir}${name}.jpg`;
  // 千帆返回 http 的 BOS 地址，iOS ATS 只放行 https
  const dl = await FileSystem.downloadAsync(url.replace(/^http:/, 'https:'), local);
  return dl.uri;
}

/** 千帆同步文生图（本地 key 直连，无 key 走服务端代理），下载到本机后返回本地 URI */
async function generateImage(prompt: string, subdir = 'portraits'): Promise<string> {
  const key = imageKey();
  const body = { model: QIANFAN_IMAGE_MODEL, prompt, size: '1024x1024', n: 1 };
  let data: { data?: { url?: string }[] };
  if (key) {
    const res = await fetch('https://qianfan.baidubce.com/v2/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Qianfan image ${res.status}`);
    data = await res.json();
  } else {
    data = await proxyJson('qianfan.images', body);
  }
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('no image url');
  return downloadTo(url, subdir, uid('img'));
}

// 立绘 prompt（画风 / 构图 / 红线）在 content/prompts.ts（D-017）

/** 外出拍照（D-051）：她主动按快门的场景照——非会话自动投放（D-037 纪律不变） */
export async function generateScenePhoto(prompt: string): Promise<string> {
  return generateImage(prompt, 'photos');
}

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
