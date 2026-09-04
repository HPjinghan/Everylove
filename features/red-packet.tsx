/**
 * 红包（D-081/D-084）：游戏币；拆不拆由 TA 决定——回复里带 [拆红包] 才「已领取」，否则「TA 没拆」，之后聊到了还能拆。
 * 一个玩法一个文件：prompt 分段（亲密 / 通话 / 记事本都带这条规则）+ 回复暗号 + 卡片种类 + 她发出时的动作。
 */

import { StyleSheet, Text, View } from 'react-native';

import { RED_PACKET_MARK, RED_PACKET_RULE } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { cardKinds } from '@/core/cards';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { sendCard, type TurnUi } from '@/core/turn';
import { BONDED_FAMILY } from '@/features/prompts';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/* ── prompt：常驻一条红包规则（之前没拆的聊到了也能拆） ── */
promptSections.register({ name: 'red-packet', modes: BONDED_FAMILY, order: ORDER.redPacket, lines: () => [RED_PACKET_RULE] });

/* ── 暗号：[拆红包] → 最近一个没拆的红包标「已领取」 ── */
replyMarkers.register({
  key: 'openRedPacket',
  mark: RED_PACKET_MARK,
  apply({ scope }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    if (!bond) return;
    const packet = [...bond.messages].reverse().find((m) => m.card?.type === 'redpacket' && !m.card.claimed);
    if (packet?.card) {
      store.patchMessage({ bondId: bond.id }, packet.id, { card: { ...packet.card, claimed: true, declined: false } });
    }
  },
});

/* ── 卡片：整个气泡染红 ── */
cardKinds.register({
  type: 'redpacket',
  bubbleColor: '#E5533D',
  contextText: (c) =>
    `（她给你发了一个 ${c.title} 的红包${c.subtitle ? `，留言「${c.subtitle}」` : ''}${c.claimed ? '，你拆了' : c.declined ? '，你没拆' : ''}）`,
  render: (c) => (
    <View style={styles.red}>
      <Text style={styles.kicker}>🧧 {t('红包')}</Text>
      <Text style={styles.amount}>{c.title}</Text>
      {c.subtitle ? <Text style={styles.note}>{c.subtitle}</Text> : null}
      <Text style={styles.state}>{c.claimed ? t('已领取') : c.declined ? t('TA 没拆') : t('等 TA 拆开')}</Text>
    </View>
  ),
});

/** 她发红包：卡片上屏 → TA 按性格决定拆不拆；这轮没拆就标「TA 没拆」（之后聊到了还能拆） */
export async function sendRedPacket(bondId: string, amount: number, note: string, ui?: TurnUi): Promise<void> {
  const scope = { mode: 'bonded' as const, bondId };
  const { id } = await sendCard(
    scope,
    { type: 'redpacket', title: `¥${amount.toFixed(2)}`, subtitle: note, amount },
    `（她给你发了一个 ¥${amount.toFixed(2)} 的红包，留言「${note}」。按你的性格和你们的关系决定拆不拆：拆了就在回复最后单独一行写 ${RED_PACKET_MARK}；不拆就说说为什么或逗她。）`,
    ui
  );
  const after = useAppStore.getState().bonds.find((b) => b.id === bondId)?.messages.find((m) => m.id === id);
  if (after?.card && !after.card.claimed) {
    useAppStore.getState().patchMessage({ bondId }, id, { card: { ...after.card, declined: true } });
  }
}

const styles = themed(() =>
  StyleSheet.create({
    red: { minWidth: 190, maxWidth: 240 },
    kicker: { fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 },
    amount: { fontSize: 24, fontWeight: '800', color: '#FFE9B8', marginTop: 4 },
    note: { fontSize: 12, color: '#FFF3E0', marginTop: 4, lineHeight: 17 },
    state: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
    // Romance 只为 themed() 的依赖收集；红包配色固定（拟真彩蛋，不随主题）
    _theme: { color: Romance.ink },
  })
);
