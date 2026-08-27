import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useAppStore } from '@/store/app-store';
import { themed } from '@/constants/theme';

/**
 * 角色头像：有立绘（D-019，生成后存本机）就显示立绘；没有则主色圆底 + 名字首字
 * （种子角色试装默认无立绘，美术预算集中给相册，见 CLAUDE.md §6）。
 * 传 characterId 会自动从 store 取立绘；传 uri 则直接用（捏＋预览用）。
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
  const src = uri ?? stored;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    letter: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  })
);
