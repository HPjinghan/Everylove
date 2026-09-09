/**
 * 相册（D-020/D-024/D-056/D-079；D-100 纸面）：你们的拍立得墙——外出拍的照片按下快门即入册（store.album）。
 * 按日分组、每行三张拍立得（components/polaroid.tsx：白框 1.5 描边 r6、Fredoka 10 手写字、微倾角）；点开大图 + 分享。
 * D-079 之前的存档照片并在羁绊会话里，仍从 bond.messages 兜底汇集。
 */

import { useMemo, useState } from 'react';
import { Dimensions, SectionList, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { PhotoViewer, Polaroid } from '@/components/polaroid';
import { Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { placeById } from '@/content/places';
import { localeOf, t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

const COLS = 3;
/** 拍立得列间距（D-100 设计稿：6） */
const GAP = 6;

interface Shot {
  id: string;
  uri: string;
  at: number;
  from: string;
  /** 大图下的完整说明 */
  caption?: string;
  /** 墙上相纸的短手写字：地点 emoji + 名字 */
  wall: string;
}

export default function AlbumScreen() {
  const bonds = useAppStore((s) => s.bonds);
  const album = useAppStore((s) => s.album);
  const [viewing, setViewing] = useState<Shot | null>(null);

  const sections = useMemo(() => {
    const shots: Shot[] = [];
    const seen = new Set<string>();
    for (const p of album) {
      const name =
        bonds.find((b) => b.characterId === p.characterId)?.name ?? findCharacter(p.characterId)?.name ?? '';
      const emoji = p.placeId ? placeById(p.placeId)?.emoji : undefined;
      shots.push({
        id: p.id,
        uri: p.uri,
        at: p.at,
        from: name,
        caption: p.caption,
        wall: emoji ? `${emoji} ${name}` : name,
      });
      seen.add(p.uri);
    }
    for (const b of bonds) {
      for (const m of b.messages) {
        if (m.kind === 'image' && m.imageUri && !seen.has(m.imageUri)) {
          shots.push({ id: m.id, uri: m.imageUri, at: m.at, from: b.name, caption: m.text || m.spoken, wall: b.name });
        }
      }
    }
    shots.sort((a, b) => b.at - a.at);
    const byDay = new Map<string, Shot[]>();
    const locale = localeOf();
    for (const s of shots) {
      const day = new Date(s.at).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' });
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(s);
    }
    // 网格：每行 COLS 张
    return [...byDay.entries()].map(([title, items]) => {
      const rows: Shot[][] = [];
      for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS));
      return { title, data: rows };
    });
  }, [bonds, album]);

  const cell = (Dimensions.get('window').width - Space.screen * 2 - GAP * (COLS - 1)) / COLS;

  return (
    <AppScreen title={t('相册')}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0].id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item: row }) => (
          <View style={styles.gridRow}>
            {row.map((shot) => (
              <Polaroid
                key={shot.id}
                uri={shot.uri}
                caption={shot.wall}
                width={cell}
                tiltKey={shot.id}
                onPress={() => setViewing(shot)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🖼️</Text>
            <Text style={styles.emptyText}>{t('还没有你们的照片。')}</Text>
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
                  `${viewing.from} · ${new Date(viewing.at).toLocaleDateString(localeOf(), {
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
    list: { padding: Space.screen, paddingBottom: 40 },
    day: { fontSize: 13, fontWeight: '600', color: Romance.ink, marginTop: 14, marginBottom: 8 },
    gridRow: { flexDirection: 'row', gap: GAP, marginBottom: 8 },
    empty: { alignItems: 'center', marginTop: 90 },
    emptyEmoji: { fontSize: 40 },
    emptyText: { textAlign: 'center', color: Romance.sub, fontSize: 13, lineHeight: 20, marginTop: 12 },
  })
);
