/**
 * 传记正文块的渲染（D-149）：文字段落 16/26 ink、段间距；图片通栏（按真实比例，取不到按 4:3）+ 12 muted 说明。
 * 传记 App 的阅读页与创造里的章节预览共用。
 */

import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import type { StoryBlock } from '@/lib/types';

const FALLBACK_RATIO = 4 / 3;

function StoryImage({ uri, caption, width }: { uri: string; caption?: string; width: number }) {
  const [ratio, setRatio] = useState(FALLBACK_RATIO);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <View style={styles.figure}>
      <Image source={{ uri }} style={[styles.image, { width, height: Math.round(width / ratio) }]} resizeMode="cover" />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

export function StoryBlocks({ blocks }: { blocks: StoryBlock[] }) {
  const { width } = useWindowDimensions();
  const inner = width - Space.screen * 2;
  return (
    <View style={styles.body}>
      {blocks.map((b, i) =>
        b.type === 'text' ? (
          <Text key={i} style={styles.para}>
            {b.text}
          </Text>
        ) : (
          <StoryImage key={i} uri={b.uri} caption={b.caption} width={inner} />
        )
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    body: { gap: 18 },
    para: { fontSize: 16, lineHeight: 26, color: Romance.ink },
    figure: { gap: 6 },
    image: { borderRadius: Shape.radius, backgroundColor: Romance.line },
    caption: { fontSize: 12, color: Romance.sub, lineHeight: 17 },
  })
);
