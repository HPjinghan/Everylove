/**
 * 传记的阅读页（D-149）：章节标题 20/600 + 正文块（components/story-blocks）；末尾一行打赏——
 * 三个 Coin 档位（10 / 50 / 100）点一下就从她的零钱扣、记一笔「打赏」，页面显示这一章累计打赏了多少（读者这边的账，创作者侧汇总走云端、未做）。
 * 还没开放的章节直接进不来（列表就不给点）；地址被手动打开也只显示空页。
 */

import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { StoryBlocks } from '@/components/story-blocks';
import { showToast } from '@/components/toast';
import { Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { chapterOpen, chaptersForBond } from '@/lib/story';
import { useAppStore } from '@/store/app-store';

const TIP_AMOUNTS = [10, 50, 100];

export default function StoryReaderScreen() {
  const { bondId, chapterId } = useLocalSearchParams<{ bondId: string; chapterId: string }>();
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === bondId));
  const customCharacters = useAppStore((s) => s.customCharacters);
  const sharedPool = useAppStore((s) => s.sharedPool);
  const tipped = useAppStore((s) => (chapterId ? s.storyTips[chapterId] ?? 0 : 0));
  const balance = useAppStore((s) => s.wallet.balance);

  const chapter = bond ? chaptersForBond(bond, { customCharacters, sharedPool }).find((c) => c.id === chapterId) : undefined;
  const open = bond && chapter ? chapterOpen(bond, chapter) : false;

  const tip = (amount: number) => {
    if (!chapter) return;
    const ok = useAppStore.getState().tipChapter(chapter.id, amount, chapter.title);
    if (!ok) showToast(t('零钱不够了'));
  };

  return (
    <AppScreen title={bond?.name ?? t('传记')}>
      <ScrollView contentContainerStyle={styles.content}>
        {chapter && open ? (
          <>
            <Text style={styles.title}>{chapter.title}</Text>
            <StoryBlocks blocks={chapter.blocks} />
            <Card style={styles.tipCard}>
              <View style={styles.tipHead}>
                <Text style={styles.tipLabel}>{t('打赏')}</Text>
                <Text style={styles.balance}>
                  <Text style={styles.balanceNum}>{balance}</Text> Coin
                </Text>
              </View>
              <View style={styles.tipRow}>
                {TIP_AMOUNTS.map((n) => (
                  <Chip key={n} label={`${n} Coin`} onPress={() => tip(n)} />
                ))}
              </View>
              {tipped > 0 ? <Text style={styles.tipped}>{t('已打赏 {n} Coin', { n: tipped })}</Text> : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: { padding: Space.screen, paddingBottom: 48, gap: 18 },
    title: { fontSize: 20, fontWeight: '600', color: Romance.ink, lineHeight: 28 },
    tipCard: { marginTop: 14, gap: 10 },
    tipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tipLabel: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    balance: { fontSize: 12, color: Romance.sub },
    balanceNum: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    tipRow: { flexDirection: 'row', gap: Space.inline, flexWrap: 'wrap' },
    tipped: { fontSize: 12, color: Romance.accentStrong },
  })
);
