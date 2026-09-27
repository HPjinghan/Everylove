/**
 * 会话 token 进 Keychain（D-184）：Supabase 的会话（access / refresh token）不再明文放 AsyncStorage。
 * expo-secure-store 单值上限 2048 字节，会话 JSON 常常超过——按 600 字符一块分块存（全部在 Keychain 里），
 * `key.n` 记块数。第一次读不到时从 AsyncStorage 同名键迁过来并删掉旧的（老存档无感升级）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK = 600;
const countKey = (k: string) => `${k}.n`;
const chunkKey = (k: string, i: number) => `${k}.${i}`;

async function migrateFromAsync(key: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key).catch(() => null);
  if (legacy === null) return null;
  await setItem(key, legacy);
  await AsyncStorage.removeItem(key).catch(() => {});
  return legacy;
}

export async function getItem(key: string): Promise<string | null> {
  const n = await SecureStore.getItemAsync(countKey(key));
  if (n === null) return migrateFromAsync(key);
  const parts: string[] = [];
  for (let i = 0; i < Number(n); i++) parts.push((await SecureStore.getItemAsync(chunkKey(key, i))) ?? '');
  return parts.join('');
}

export async function setItem(key: string, value: string): Promise<void> {
  const old = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
  const n = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(countKey(key), String(n));
  for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {});
}

export async function removeItem(key: string): Promise<void> {
  const old = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
  for (let i = 0; i < old; i++) await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => {});
  await SecureStore.deleteItemAsync(countKey(key)).catch(() => {});
}

/** Supabase auth 的 storage 适配器 */
export const secureStorage = { getItem, setItem, removeItem };
