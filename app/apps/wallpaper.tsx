/**
 * 壁纸（D-258）：壁纸是壁纸、主题是主题——这里只换桌面的底。
 * - 跟着主题：铺主题自带的那块纸（默认）。
 * - 从手机相册选：拷进 App 自己的目录再存（相册给的是缓存路径，系统随时会清，D-203）。
 * - App 里的图：外出拍的拍立得、TA 们的立绘（跟着立绘走，重画了壁纸也换）、TA 在聊天里发来的照片。
 * 上面一块小预览照桌面的样子画（照片压一层淡墨、白字时钟）。
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card, Divider } from '@/components/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Wallpaper, wallpaperKey, wallpaperSource } from '@/components/wallpaper';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { Shape, Space, Type } from '@/constants/design';
import { t } from '@/lib/i18n';
import { portraitSource } from '@/lib/imagegen';
import { copyIntoDocuments } from '@/lib/media-paths';
import type { WallpaperPick } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 页面左右留白（同设置页） */
const GUTTER = 18;
const GAP = 8;
const COLS = 3;
/** 聊天里 TA 发来的照片最多列几张（最近的在前） */
const CHAT_PHOTOS_MAX = 30;

interface Option {
  pick: WallpaperPick;
  source: ImageSourcePropType;
}

export default function WallpaperScreen() {
  const current = useAppStore((s) => s.wallpaper);
  const album = useAppStore((s) => s.album);
  const bonds = useAppStore((s) => s.bonds);
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - GUTTER * 2 - GAP * (COLS - 1)) / COLS);
  const set = (pick: WallpaperPick | null) => useAppStore.getState().setWallpaper(pick);

  const groups = useMemo(() => {
    const photo = (uri: string): Option => ({ pick: { kind: 'photo', uri }, source: { uri } });
    const polaroids = [...album].sort((a, b) => b.at - a.at).map((s) => photo(s.uri));
    const portraits = bonds.flatMap((b): Option[] => {
      const source = portraitSource(b.characterId);
      return source ? [{ pick: { kind: 'portrait', characterId: b.characterId }, source }] : [];
    });
    const sent = bonds
      .flatMap((b) => b.messages.filter((m) => m.from === 'him' && m.kind === 'image' && m.imageUri && !m.recalled))
      .sort((a, b) => b.at - a.at)
      .slice(0, CHAT_PHOTOS_MAX)
      .map((m) => photo(m.imageUri!));
    return [
      { title: t('拍立得'), items: polaroids },
      { title: t('立绘'), items: portraits },
      { title: t('TA 发来的'), items: sent },
    ].filter((g) => g.items.length);
  }, [album, bonds]);

  const fromPhone = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const uri = !result.canceled ? result.assets[0]?.uri : undefined;
    if (uri) set({ kind: 'photo', uri: await copyIntoDocuments(uri, 'photos') });
  };

  const currentKey = wallpaperKey(current);
  const preview = wallpaperSource(current);

  return (
    <AppScreen title={t('壁纸')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.previewWrap}>
          <View style={styles.preview}>
            <Wallpaper source={preview} />
            <Text style={[styles.previewClock, !!preview && styles.previewClockOnPhoto]}>9:41</Text>
          </View>
        </View>

        <Card padded={false} style={styles.card}>
          <OptionRow label={t('跟着主题')} on={!current} onPress={() => set(null)} />
          <Divider soft />
          <OptionRow label={t('从手机相册选')} chevron onPress={() => void fromPhone()} />
        </Card>

        {groups.map((g) => (
          <View key={g.title} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.grid}>
              {g.items.map((o) => {
                const key = wallpaperKey(o.pick);
                const on = key === currentKey;
                return (
                  <Pressable key={key} onPress={() => set(o.pick)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <View style={[styles.thumb, { width: tile, height: Math.round(tile * 4 / 3) }, on && styles.thumbOn]}>
                      <Image source={o.source} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {on ? (
                        <View style={styles.thumbCheck}>
                          <IconSymbol name="checkmark" size={13} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

function OptionRow({ label, on, chevron, onPress }: { label: string; on?: boolean; chevron?: boolean; onPress: () => void }): ReactNode {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {on ? <IconSymbol name="checkmark" size={16} color={Romance.accent} /> : null}
      {chevron ? <Text style={styles.rowChevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: GUTTER, paddingBottom: 40 },
    previewWrap: { alignItems: 'center', paddingVertical: Space.screen },
    // 一部小手机的比例（9 : 19.5）
    preview: {
      width: 132,
      aspectRatio: 9 / 19.5,
      borderRadius: Shape.radiusButton,
      overflow: 'hidden',
      alignItems: 'center',
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
    },
    previewClock: { marginTop: 26, fontFamily: Fonts.labelBold, fontSize: Type.scale.h1.size, color: Romance.ink },
    previewClockOnPhoto: {
      color: '#FFFFFF',
      textShadowColor: withAlpha(Romance.ink, 0.45),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    card: { marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, paddingVertical: 12, paddingHorizontal: Space.cardX },
    rowLabel: { flex: 1, fontSize: Type.scale.body.size, color: Romance.ink },
    rowChevron: { fontSize: Type.scale.xl.size, lineHeight: Type.scale.xl.size, color: Romance.faint },
    group: { marginTop: 16 },
    groupTitle: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.sub, marginBottom: Space.inline },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    thumb: { borderRadius: Shape.radius, overflow: 'hidden', backgroundColor: Romance.line, borderWidth: 2, borderColor: 'transparent' },
    thumbOn: { borderColor: Romance.accent },
    thumbCheck: {
      position: 'absolute',
      right: 6,
      bottom: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
