import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Shape } from '@/constants/design';
import { Fonts, themed } from '@/constants/theme';
import { seedPortrait } from '@/content/portraits';
import { useAppStore } from '@/store/app-store';

/**
 * 角色头像（D-100 纸面：方块 r6，角色色底 + 衬线单字）：有立绘就显示立绘——她生成 / 上传 / 重画的（store.portraits）优先，
 * 种子角色回落内置立绘（D-092）；都没有则角色色底 + 名字首字。传 characterId 会自动取立绘；传 uri 则直接用（创造预览用）。
 */
export function CharAvatar({
  name,
  color,
  size = 44,
  style,
  characterId,
  uri,
}: {
  name: string;
  color: string;
  size?: number;
  style?: ViewStyle;
  characterId?: string;
  uri?: string;
}) {
  const stored = useAppStore((s) => (characterId ? s.portraits[characterId] : undefined));
  const own = uri ?? stored;
  const src = own ? { uri: own } : characterId ? seedPortrait(characterId) : undefined;
  return (
    <View style={[styles.box, { width: size, height: size, backgroundColor: color }, style]}>
      {src ? (
        <Image source={src} style={{ width: size, height: size }} contentFit="cover" transition={200} />
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.44 }]}>{name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: {
      borderRadius: Shape.radius,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    letter: {
      color: '#FFFFFF',
      fontFamily: Fonts.initial,
      fontWeight: '600',
    },
  })
);
