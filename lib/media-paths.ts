/**
 * 本机媒体路径（D-203）：
 * - 选图 / 选立绘从相册拿到的是 cache 路径，系统随时会清——拷进 documentDirectory 再存；
 * - documentDirectory 的绝对路径在重装 / 换机恢复 / iOS 升级后会变（Application/<uuid>/Documents）——
 *   启动时把存档里所有旧前缀改成现在的（相册 / 会话图片 / 立绘 / 传记图片全在存档 JSON 里，改字符串一次到位）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { uid } from '@/lib/format';
import { useAppStore } from '@/store/app-store';

const STORE_KEY = 'everylove-store';
const DOC_PREFIX_RE = /file:\/\/\/[^"\\]*?\/Documents\//g;

/** 把一个 cache / 任意 file:// 图片拷进 documentDirectory/<subdir>/，返回新路径；拷不动就原样返回 */
export async function copyIntoDocuments(uri: string, subdir: 'photos' | 'portraits' | 'story'): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root || !uri.startsWith('file:') || uri.startsWith(root)) return uri;
  const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5);
  const dir = `${root}${subdir}/`;
  const to = `${dir}${uid('img')}.${/^[a-z0-9]+$/.test(ext) ? ext : 'jpg'}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    await FileSystem.copyAsync({ from: uri, to });
    return to;
  } catch (e) {
    console.warn('[media] 拷进 Documents 失败，先用原路径：', e);
    return uri;
  }
}

/** 纯函数：把存档 JSON 里所有 documentDirectory 前缀换成现在的；没变返回 null */
export function repairStoreJson(raw: string, currentRoot: string): string | null {
  if (!DOC_PREFIX_RE.test(raw)) return null;
  DOC_PREFIX_RE.lastIndex = 0;
  const fixed = raw.replace(DOC_PREFIX_RE, (m) => (m === currentRoot ? m : currentRoot));
  return fixed === raw ? null : fixed;
}

/** 启动任务：路径变了就改存档并重新水合 */
export async function repairMediaPaths(): Promise<boolean> {
  const root = FileSystem.documentDirectory;
  if (!root) return false;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const fixed = repairStoreJson(raw, root);
    if (!fixed) return false;
    await AsyncStorage.setItem(STORE_KEY, fixed);
    await useAppStore.persist.rehydrate();
    console.log('[media] 存档里的文件路径已改成这台机的');
    return true;
  } catch (e) {
    console.warn('[media] 路径修复失败：', e);
    return false;
  }
}
