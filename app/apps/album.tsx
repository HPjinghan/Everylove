/**
 * 相册（D-020/D-024/D-056）：你们的拍立得墙——外出拍的照片结束时并入羁绊会话，在这里汇集。
 * 按日分组、拍立得框网格；点开大图 + 分享（components/polaroid.tsx）。
 */

import { useMemo, useState } from 'react';
import { Dimensions, SectionList, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { PhotoViewer, Polaroid } from '@/components/polaroid';
import { Romance, themed } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

const COLS = 3;
const GAP = 4;

interface Shot {
  id: string;
  uri: string;
  at: number;
  from: string;
  caption?: string;
}

export default function AlbumScreen() {
  const bonds = useAppStore((s) => s.bonds);
  const [viewing, setViewing] = useState<Shot | null>(null);

  const sections = useMemo(() => {
    const shots: Shot[] = [];
    for (const b of bonds) {
      for (const m of b.messages) {
        if (m.kind === 'image' && m.imageUri) {
          shots.push({ id: m.id, uri: m.imageUri, at: m.at, from: b.name, caption: m.text || m.spoken });
        }
      }
    }
    shots.sort((a, b) => b.at - a.at);
    const byDay = new Map<string, Shot[]>();
    for (const s of shots) {
      const day = new Date(s.at).toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(s);
    }
    // 网格：每行 COLS 张
    return [...byDay.entries()].map(([title, items]) => {
      const rows: Shot[][] = [];
      for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS));
      return { title, data: rows };
    });
  }, [bonds]);

  const cell = (Dimensions.get('window').width - 14 * 2 - GAP * (COLS - 1)) / COLS;

  return (
    <AppScreen title="相册">
      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0].id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text style={styles.day}>{section.title}</Text>
        )}
        renderItem={({ item: row }) => (
          <View style={styles.gridRow}>
            {row.map((shot) => (
              <Polaroid
                key={shot.id}
                uri={shot.uri}
                width={cell}
                tiltKey={shot.id}
                onPress={() => setViewing(shot)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyHeart}>🖼️</Text>
            <Text style={styles.emptyText}>
              你们的每一个瞬间都会存在这里。{'\n'}聊得越久，相册越厚。
            </Text>
          </View>
        }
      />

      <PhotoViewer
        shot={
          viewing
            ? {
                uri: viewing.uri,
                caption:
                  viewing.caption ||
                  `${viewing.from} · ${new Date(viewing.at).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })}`,
              }
            : null
        }
        onClose={() => setViewing(null)}
      />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: 14, paddingBottom: 40 },
    day: { fontSize: 13, fontWeight: '600', color: Romance.ink, marginTop: 12, marginBottom: 8 },
    gridRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
    empty: { alignItems: 'center', marginTop: 90 },
    emptyHeart: { fontSize: 40 },
    emptyText: { textAlign: 'center', color: Romance.sub, fontSize: 13, lineHeight: 20, marginTop: 12 },
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(20,12,14,0.94)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    viewerImg: { width: '100%', height: '70%' },
    viewerMeta: { color: '#fff', fontSize: 13, marginTop: 14, opacity: 0.8 },
    viewerCaption: { color: '#fff', fontSize: 13, marginTop: 6, textAlign: 'center', opacity: 0.9 },
  })
);
