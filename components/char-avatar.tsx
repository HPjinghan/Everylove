import { StyleSheet, Text, View, ViewStyle } from 'react-native';

/** 试装无立绘：主色圆底 + 名字首字（美术预算集中给相册，见 CLAUDE.md §6） */
export function CharAvatar({
  name,
  color,
  size = 44,
  style,
}: {
  name: string;
  color: string;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
