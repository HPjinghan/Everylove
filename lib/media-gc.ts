/**
 * 媒体目录清理（D-186）：documentDirectory 下的 tts / photos / portraits 只增不减——
 * 启动时扫一遍：语音合成缓存超过 TTS_KEEP_MS 的删；照片 / 立绘没被任何状态引用（相册、会话里 TA 发的图、立绘表、自创角色）的删。
 * 只在启动跑一次；任何一步出错都跳过，不影响别的。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { useAppStore } from '@/store/app-store';

/** 语音合成缓存保留多久 */
export const TTS_KEEP_MS = 7 * 86400_000;

async function sweep(dir: string, shouldDelete: (uri: string) => Promise<boolean>): Promise<number> {
  let names: string[];
  try {
    const list = await FileSystem.readDirectoryAsync(dir);
    if (!Array.isArray(list)) return 0;
    names = list;
  } catch {
    return 0;
  }
  let n = 0;
  for (const name of names) {
    const uri = dir + name;
    try {
      if (await shouldDelete(uri)) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        n++;
      }
    } catch {
      /* 单个文件出错跳过 */
    }
  }
  return n;
}

/** 清理并返回删掉的文件数 */
export async function gcMedia(now = Date.now()): Promise<number> {
  const root = FileSystem.documentDirectory;
  if (!root) return 0;
  let removed = 0;
  removed += await sweep(`${root}tts/`, async (uri) => {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info.exists && 'modificationTime' in info && typeof info.modificationTime === 'number' && info.modificationTime * 1000 < now - TTS_KEEP_MS;
  });
  // 状态快照里出现过文件名的都算被引用（相册 / 会话图片 / 立绘表 / 自创角色的 portraitUri……）
  const snapshot = JSON.stringify(useAppStore.getState());
  for (const sub of ['photos', 'portraits']) {
    removed += await sweep(`${root}${sub}/`, async (uri) => !snapshot.includes(uri.slice(uri.lastIndexOf('/') + 1)));
  }
  if (removed) console.log(`[media-gc] 清了 ${removed} 个文件`);
  return removed;
}
