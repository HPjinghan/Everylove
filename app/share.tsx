/**
 * 转给他（D-117）：系统分享面板 → everylove → 这一页——上面是分享来的内容预览，下面是通讯录里缔结的 TA，点谁就转给谁，然后直接落进那段会话。
 * 进来的参数由根布局的 ShareIntentGate 从 expo-share-intent 取出（text / url / image）。没有羁绊时提示先去交友。
 */

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { sendShare } from '@/features/share';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function ShareScreen() {
  const { text, url, image } = useLocalSearchParams<{ text?: string; url?: string; image?: string }>();
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const [sending, setSending] = useState<string | null>(null);

  const give = (bondId: string) => {
    if (sending) return;
    setSending(bondId);
    // 不等 TA 回：落进会话就跳过去，TA 的回复在会话里出现
    void sendShare(bondId, { text, url, imageUri: image });
    router.replace({ pathname: '/bond/[bondId]', params: { bondId } });
  };

  return (
    <AppScreen title={t('转给他')} onBack={() => router.replace('/')}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.preview}>
          {image ? <Image source={{ uri: image }} style={styles.previewImage} contentFit="cover" /> : null}
          {text ? (
            <Text style={styles.previewText} numberOfLines={6}>
              {text}
            </Text>
          ) : null}
          {url && url !== text ? (
            <Text style={styles.previewUrl} numberOfLines={2}>
              {url}
            </Text>
          ) : null}
          {!image && !text && !url ? <Text style={styles.previewText}>{t('…')}</Text> : null}
        </Card>

        <Text style={styles.eyebrow}>{t('转给谁')}</Text>
        {bonds.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('通讯录里还没有人。')}</Text>
            <Button label={t('去交友')} size="md" onPress={() => router.replace('/apps/dating')} />
          </View>
        ) : (
          bonds.map((b) => {
            const c = findCharacter(b.characterId);
            if (!c) return null;
            return (
              <Pressable key={b.id} onPress={() => give(b.id)} disabled={!!sending}>
                <Card style={styles.row}>
                  <CharAvatar name={b.name} color={c.color} size={44} characterId={c.id} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {c.identity}
                    </Text>
                  </View>
                  <Text style={styles.go}>{sending === b.id ? t('转过去了') : t('转给 TA ›')}</Text>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { padding: Space.screen, gap: Space.inline, paddingBottom: 40 },
    preview: { gap: 8 },
    previewImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: Shape.radius, backgroundColor: Romance.line },
    previewText: { fontSize: 14, lineHeight: 21, color: Romance.ink },
    previewUrl: { fontSize: 12, color: Romance.accent },
    eyebrow: { fontSize: 12, fontWeight: '500', color: Romance.sub, letterSpacing: 0.5, marginTop: 8, marginLeft: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    rowText: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    go: { fontSize: 13, fontWeight: '600', color: Romance.accent },
    empty: { alignItems: 'center', paddingTop: 30, gap: 14 },
    emptyText: { fontSize: 13, color: Romance.sub },
  })
);
