/**
 * 图像生成：Qwen 文生图，走百度千帆 v2 同步接口（与聊天共用一把千帆 key，D-014）。
 * D-037 起只剩一个用途：**立绘**——捏＋时生成一次（或开发者面板为种子角色生成），
 * 存本机，作头像与卡面用。会话内生图（初见画面/羁绊画面）已下线：聊天与初见回归纯文本。
 * 红线约束写死在 prompt：暧昧合规、不做真人。
 * 生成图下载到本机（图片 URL 24 小时过期，资产不能丢）。
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Image, type ImageSourcePropType } from 'react-native';

import { seedPortrait } from '@/content/portraits';
import { buildPortraitPrompt, imageModelFor, PORTRAIT_NEGATIVE } from '@/content/prompts';
// （外出拍照的 prompt 由调用方拼好传入，见 content/prompts/photo.ts 的 buildOutingPhotoPrompt，D-051）
import { CONFIG } from '@/core/config';
import { postJsonWithTimeout, proxyJson, proxyReadySync } from '@/lib/proxy';
import { uid } from '@/lib/format';
import type { Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

export const QIANFAN_IMAGE_MODEL = CONFIG.qianfanImageModel;

/** 只读工程配置（开发者面板手填已下线，D-069） */
function imageKey(): string {
  return CONFIG.qianfanKey;
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

/** 百度蒸汽机 Air-Image 走专用端点（通用端点对它不回，2026-09-02 实测；D-071）；它不收 n */
const MUSE_MODEL_PREFIX = 'musesteamer';
/** 生图等待上限（D-109）：qwen-image 约 1 分钟、偶尔更久；蒸汽机约 10 秒 */
const IMAGE_TIMEOUT_MS = 180_000;

/**
 * 千帆同步文生图（本地 key 直连，无 key 走服务端代理），下载到本机后返回本地 URI。
 * model 由画风决定（D-076：动漫 → 蒸汽机，其余 → qwen-image）；不传按工程默认。
 */
async function generateImage(prompt: string, subdir = 'portraits', model: string = QIANFAN_IMAGE_MODEL): Promise<string> {
  const key = imageKey();
  const muse = model.startsWith(MUSE_MODEL_PREFIX);
  // qwen-image 带反向提示（D-092：别把名字画进画面）；蒸汽机不收该参数
  const body = muse
    ? { model, prompt, size: '1024x1024' }
    : { model, prompt, size: '1024x1024', n: 1, negative_prompt: PORTRAIT_NEGATIVE };
  let data: { data?: { url?: string }[] };
  if (key) {
    const endpoint = muse
      ? 'https://qianfan.baidubce.com/v2/musesteamer/images/generations'
      : 'https://qianfan.baidubce.com/v2/images/generations';
    const res = await postJsonWithTimeout(
      endpoint,
      { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body,
      IMAGE_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`Qianfan image ${res.status}: ${res.text.slice(0, 160)}`);
    data = JSON.parse(res.text);
  } else {
    data = await proxyJson(muse ? 'qianfan.musesteamer' : 'qianfan.images', body, IMAGE_TIMEOUT_MS);
  }
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('no image url');
  return downloadTo(url, subdir, uid('img'));
}

// 立绘 prompt（画风表 / system / 红线）在 content/prompts/portrait.ts（D-017/D-087）

/** 外出拍照（D-051）：她主动按快门的场景照——非会话自动投放（D-037 纪律不变）；模型跟角色画风走（D-076） */
export async function generateScenePhoto(prompt: string, character?: Pick<Character, 'artStyle'>): Promise<string> {
  return generateImage(prompt, 'photos', character ? imageModelFor(character) : QIANFAN_IMAGE_MODEL);
}

/* ────────────────────────────── 立绘（D-019） ────────────────────────────── */

/**
 * 角色立绘（D-092 起统一从这里取）：她自己生成 / 上传 / 重画的（store.portraits）优先，其次种子角色的内置立绘。
 * portraitSource 给 <Image source>；portraitFor 给需要 URI 字符串的地方（相册、分享），内置资源经 resolveAssetSource 解成 URI。
 */
export function portraitSource(characterId: string, stored?: string): ImageSourcePropType | undefined {
  const own = stored ?? useAppStore.getState().portraits[characterId];
  if (own) return { uri: own };
  return seedPortrait(characterId);
}

export function portraitFor(characterId: string): string | undefined {
  const own = useAppStore.getState().portraits[characterId];
  if (own) return own;
  const seed = seedPortrait(characterId);
  return seed ? Image.resolveAssetSource(seed)?.uri : undefined;
}

/** 只生成、不入库：捏＋预览用（角色还没创建，先看一眼、可重生成） */
export async function generatePortraitFor(character: Character): Promise<string> {
  return generateImage(buildPortraitPrompt(character), 'portraits', imageModelFor(character));
}

const portraitInflight = new Set<string>();

/**
 * 确保某角色有立绘：没有（本机没生成过、也没有内置）就生成并入库（后台、静默失败）。force=true 重生成（结果存本机，盖过内置）。
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
