/**
 * 配角头像池：TA 身边的人（家人 / 朋友 / 同事）在 X 评论区等处的头像，随包分发。
 * 来源 DiceBear（https://www.dicebear.com）「Lorelei」风格（Lisa Wischofsky 原作的改编），
 * 许可 CC0 1.0（https://www.dicebear.com/licenses/ 核实；2026-10-27 取图）：可商用、可再分发、无需署名。
 * 全是手绘插画，不是真人照片（红线一）。128×128 PNG，粉 / 杏 / 蓝 / 绿 / 紫 / 黄六种浅底轮换，
 * 种子与参数见 assets/avatars/LICENSE.md。同一个 key 永远拿到同一张（FNV-1a 取模）。
 */

import type { ImageSourcePropType } from 'react-native';

export const AVATAR_POOL: ImageSourcePropType[] = [
  require('../assets/avatars/a01.png'),
  require('../assets/avatars/a02.png'),
  require('../assets/avatars/a03.png'),
  require('../assets/avatars/a04.png'),
  require('../assets/avatars/a05.png'),
  require('../assets/avatars/a06.png'),
  require('../assets/avatars/a07.png'),
  require('../assets/avatars/a08.png'),
  require('../assets/avatars/a09.png'),
  require('../assets/avatars/a10.png'),
  require('../assets/avatars/a11.png'),
  require('../assets/avatars/a12.png'),
  require('../assets/avatars/a13.png'),
  require('../assets/avatars/a14.png'),
  require('../assets/avatars/a15.png'),
  require('../assets/avatars/a16.png'),
  require('../assets/avatars/a17.png'),
  require('../assets/avatars/a18.png'),
  require('../assets/avatars/a19.png'),
  require('../assets/avatars/a20.png'),
  require('../assets/avatars/a21.png'),
  require('../assets/avatars/a22.png'),
  require('../assets/avatars/a23.png'),
  require('../assets/avatars/a24.png'),
  require('../assets/avatars/a25.png'),
  require('../assets/avatars/a26.png'),
  require('../assets/avatars/a27.png'),
  require('../assets/avatars/a28.png'),
  require('../assets/avatars/a29.png'),
  require('../assets/avatars/a30.png'),
  require('../assets/avatars/a31.png'),
  require('../assets/avatars/a32.png'),
];

/** FNV-1a 32 位：跨启动稳定，同一个 key 永远同一张 */
function fnv1a(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 按 key（如配角 id 或名字）确定地挑一张头像 */
export function avatarFor(key: string): number {
  return AVATAR_POOL[fnv1a(key) % AVATAR_POOL.length] as number;
}
