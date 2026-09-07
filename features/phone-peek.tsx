/**
 * 查 TA 的手机（D-082/D-084）：第一次要先拿到密码——锁屏上自己猜，或点「问 TA 要密码」发一张「想看看你的手机」卡片，
 * TA 按性格 × 亲密度决定给不给；答应即说出密码并在回复末尾写 [解锁手机]（她看不到），引擎剥掉、状态解锁。
 * 一个玩法一个文件：prompt 分段（TA 知道自己的密码）+ 回复暗号 + 卡片种类 + 「问 TA 要密码」的动作。
 */

import { CardShell } from '@/components/card-bubble';
import { PHONE_UNLOCK_MARK, phoneBlock } from '@/content/prompts';
import { cardKinds } from '@/core/cards';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { sendCard, sysMsg, type TurnUi } from '@/core/turn';
import { BONDED_CHAT } from '@/features/prompts';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/* ── prompt：TA 知道自己的密码，她要看时由 TA 决定 ── */
promptSections.register({ name: 'phone', modes: BONDED_CHAT, order: ORDER.phone, lines: (ctx) => phoneBlock(ctx) });

/* ── 暗号：[解锁手机] → 解锁 + 系统条（聊天里、电话里都一样） ── */
replyMarkers.register({
  key: 'unlockPhone',
  mark: PHONE_UNLOCK_MARK,
  apply({ scope, mode }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    if (!bond || bond.phoneUnlocked) return;
    store.setPhoneUnlocked(bond.id);
    mode.append(scope, [sysMsg(t('TA 同意让你看手机了'))]);
  },
});

/* ── 卡片：想看看你的手机 ── */
cardKinds.register({
  type: 'phoneRequest',
  contextText: () => '（她想看你的手机，问你要密码）',
  render: (c, dark) => <CardShell emoji="📱" kicker={t('查手机')} title={c.title} subtitle={c.subtitle} dark={dark} />,
});

/** 锁屏上的「问 TA 要密码」：发一张卡片，TA 按性格决定给不给（给就说出密码并写暗号） */
export async function askPasscode(bondId: string, ui?: TurnUi): Promise<void> {
  const store = useAppStore.getState();
  const bond = store.bonds.find((b) => b.id === bondId);
  if (!bond) return;
  const code = store.ensurePhoneCode(bond.id);
  await sendCard(
    { mode: 'bonded', bondId },
    { type: 'phoneRequest', title: t('想看看你的手机') },
    `（她按了「问 TA 要密码」：${bond.nickname} 想看看你的手机。按你的性格和你们现在的亲密程度决定给不给：给就把密码 ${code} 告诉她，并在回复最后单独一行写 ${PHONE_UNLOCK_MARK}；不给就说明为什么或逗她，不写标记。）`,
    ui
  );
}
