/**
 * 网页预览用（开发时在浏览器里看界面）：浏览器没有 Keychain，expo-secure-store 在 web 上不可用，
 * 会话直接放 AsyncStorage（= localStorage）。App（iOS）走 secure-storage.ts 的 Keychain。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const getItem = (key: string): Promise<string | null> => AsyncStorage.getItem(key);
export const setItem = (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value);
export const removeItem = (key: string): Promise<void> => AsyncStorage.removeItem(key);

/** Supabase auth 的 storage 适配器 */
export const secureStorage = { getItem, setItem, removeItem };
