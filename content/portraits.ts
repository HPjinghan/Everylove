/**
 * 种子角色的内置立绘（D-092）：随包分发，所有人打开 App 原始角色默认就有形象。
 * 图由 scripts/gen-seed-portraits.mts 用 App 同一套 prompt 生成（content/prompts/portrait.ts）；
 * 加角色 = 跑一次脚本再在这里加一行。她自己重画过的（store.portraits）优先于内置。
 */

import type { ImageSourcePropType } from 'react-native';

export const SEED_PORTRAITS: Record<string, ImageSourcePropType> = {
  'shen-zhiyan': require('../assets/portraits/shen-zhiyan.jpg'),
  'jiang-ye': require('../assets/portraits/jiang-ye.jpg'),
  'su-cheng': require('../assets/portraits/su-cheng.jpg'),
  'luo-xiaoman': require('../assets/portraits/luo-xiaoman.jpg'),
  'zhu-yuan': require('../assets/portraits/zhu-yuan.jpg'),
  'hu-bugui': require('../assets/portraits/hu-bugui.jpg'),
};

export function seedPortrait(characterId: string): ImageSourcePropType | undefined {
  return SEED_PORTRAITS[characterId];
}
