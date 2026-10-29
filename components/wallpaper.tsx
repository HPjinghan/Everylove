/**
 * 壁纸（D-258）：壁纸是壁纸、主题是主题。
 * - ThemePaper：主题自带的那块纸——主题色的浅底 + 同一族颜色的菱格暗纹。没选照片时桌面铺它；
 *   配对成功与缔结仪式（手机本身在庆祝）也铺它。
 * - Wallpaper：桌面的底——选了照片就铺照片（满屏裁切 + 一层很淡的墨色，压在上面的白字读得清），
 *   文件没了（换机、被清理）就回到主题自带的纸。照片可以是手机里选的、App 里的拍立得与 TA 发来的照片，或某位 TA 的立绘。
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { DiamondBackground } from '@/components/paper-bg';
import { Romance, THEMES, withAlpha, type ThemeId } from '@/constants/theme';
import { portraitSource } from '@/lib/imagegen';
import type { WallpaperPick } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 照片压暗的那一层 */
const PHOTO_SCRIM = 0.14;

export function ThemePaper({ theme }: { theme?: ThemeId }) {
  const current = useAppStore((s) => s.theme);
  const paper = THEMES[theme ?? current].paper;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: paper.bg }]}>
      <DiamondBackground color={paper.pattern} />
    </View>
  );
}

/** 选中的壁纸对应的图；立绘跟着那位 TA 现在的立绘走 */
export function wallpaperSource(pick: WallpaperPick | null): ImageSourcePropType | undefined {
  if (!pick) return undefined;
  return pick.kind === 'photo' ? { uri: pick.uri } : portraitSource(pick.characterId);
}

/** 同一张壁纸的稳定键：读坏了记住是哪一张，换了别的再试 */
export function wallpaperKey(pick: WallpaperPick | null): string {
  return !pick ? '' : pick.kind === 'photo' ? pick.uri : `portrait:${pick.characterId}`;
}

/** 桌面现在铺不铺照片（铺照片时桌面上的字换白色） */
export function useWallpaperPhoto(): { source?: ImageSourcePropType; onError: () => void } {
  const pick = useAppStore((s) => s.wallpaper);
  const [broken, setBroken] = useState<string | null>(null);
  const key = wallpaperKey(pick);
  const source = key && key !== broken ? wallpaperSource(pick) : undefined;
  return { source, onError: () => setBroken(key) };
}

export function Wallpaper({ source, onError }: { source?: ImageSourcePropType; onError?: () => void }) {
  if (!source) return <ThemePaper />;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" onError={onError} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(Romance.ink, PHOTO_SCRIM) }]} />
    </View>
  );
}
