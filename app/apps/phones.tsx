/**
 * 查手机（D-085；D-100 纸面；D-110 一部真的手机）：桌面入口——所有缔结的 TA 各一部手机可选（锁屏 → 角色色桌面 → 点 App 进去看，components/his-phone.tsx），
 * 还能反过来「让 TA 看我的手机」：先弹底部确认卡（说明 TA 会读到什么、看完会发消息、不可撤回），确认后
 * TA 翻记事本与她和别人的聊天，然后给她发消息（features/phone-peek.tsx peekMyPhone）。
 * 锁屏上「问 TA 要密码」不再跳回会话：卡片照发，TA 的回复在锁屏上原地显示（components/phone-lock.tsx）。
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alertAiUnavailable } from '@/components/ai-unavailable';
import { AppScreen } from '@/components/app-screen';
import { ConfirmSheet } from '@/components/action-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { PhoneSheet } from '@/components/his-phone';
import { PeekReplay, type PeekPayload } from '@/components/peek-replay';
import { PhoneLock } from '@/components/phone-lock';
import { Shape, Space } from '@/constants/design';
import { Romance, themed, withAlpha } from '@/constants/theme';
import { askPasscode as askHisPasscode, peekMyPhone, peekPayload } from '@/features/phone-peek';
import { aiReadySync } from '@/lib/chat';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 手机壳 56×92、r10：唯一一处不是 6 的圆角——它画的是一部手机的外形，不是卡片 */
const SHELL = { width: 56, height: 92, radius: 10 } as const;

export default function PhonesScreen() {
  const bonds = useAppStore((s) => s.bonds);
  const [openId, setOpenId] = useState<string | null>(null);
  const [peeking, setPeeking] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // 「TA 正在看」回放（D-118）：和 peekMyPhone 用同一份数据；放完且 TA 回了话才关
  const [replay, setReplay] = useState<{ bondId: string; payload: PeekPayload } | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  // 密码第一次需要时生成（D-082）——在 effect 里写 store，渲染期只读（D-197）
  useEffect(() => {
    if (openId) useAppStore.getState().ensurePhoneCode(openId);
  }, [openId]);

  const open = bonds.find((b) => b.id === openId);
  const openCharacter = open ? findCharacter(open.characterId) : undefined;
  const confirming = bonds.find((b) => b.id === confirmId);

  const invitePeek = (bondId: string) => {
    setConfirmId(null);
    if (!aiReadySync()) {
      alertAiUnavailable();
      return;
    }
    setPeeking(bondId);
    setReplayDone(false);
    setReplay({ bondId, payload: peekPayload(bondId) });
    void peekMyPhone(bondId).finally(() => {
      setPeeking(null);
      setReplayDone(true);
    });
  };

  return (
    <AppScreen title={t('查手机')}>
      <ScrollView contentContainerStyle={styles.list}>
        {bonds.length === 0 ? (
          <Text style={styles.empty}>{t('这里还空着。')}</Text>
        ) : (
          bonds.map((b) => {
            const c = findCharacter(b.characterId);
            if (!c) return null;
            return (
              <Card key={b.id} style={styles.row}>
                <Pressable style={styles.shellWrap} onPress={() => setOpenId(b.id)}>
                  <View style={[styles.shell, { backgroundColor: c.color }]}>
                    <CharAvatar name={b.name} color="rgba(255,255,255,0.18)" size={40} characterId={c.id} />
                    <View style={styles.shellBar} />
                  </View>
                </Pressable>
                <View style={styles.main}>
                  <Text style={styles.name} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {c.identity}
                  </Text>
                  <View style={styles.actions}>
                    <Button label={t('看 TA 的手机')} variant="paper" size="sm" onPress={() => setOpenId(b.id)} />
                    <Button
                      label={peeking === b.id ? t('TA 在看…') : t('让 TA 看我的手机')}
                      variant="primary"
                      size="sm"
                      disabled={peeking === b.id}
                      onPress={() => setConfirmId(b.id)}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* 二次确认（D-100 交互改动 6）：隐私与数据说明，确认后才 peekMyPhone——纸面确认卡（D-198） */}
      <ConfirmSheet
        visible={!!confirming}
        title={t('让{name}看你的手机？', { name: confirming?.name ?? '' })}
        body={t('TA 会读到：记事本的全部内容、日历里的安排、你和其他人最近的聊天。看完 TA 会给你发消息。这一步不能撤回。')}
        confirmLabel={t('让 TA 看')}
        onConfirm={() => confirming && invitePeek(confirming.id)}
        onClose={() => setConfirmId(null)}
      />

      {replay ? (
        <PeekReplay
          visible
          name={bonds.find((b) => b.id === replay.bondId)?.name ?? ''}
          characterId={bonds.find((b) => b.id === replay.bondId)?.characterId ?? ''}
          color={findCharacter(bonds.find((b) => b.id === replay.bondId)?.characterId ?? '')?.color ?? Romance.accent}
          payload={replay.payload}
          done={replayDone}
          onClose={() => setReplay(null)}
        />
      ) : null}

      {open && openCharacter ? (
        <>
          <PhoneLock
            visible={!open.phoneUnlocked}
            color={openCharacter.color}
            passcode={open.phoneCode ?? ''}
            onUnlock={() => useAppStore.getState().setPhoneUnlocked(open.id)}
            onAsk={() => void askHisPasscode(open.id)}
            onClose={() => setOpenId(null)}
            bondId={open.id}
            characterId={openCharacter.id}
            name={open.name}
          />
          <PhoneSheet
            visible={!!open.phoneUnlocked}
            onClose={() => setOpenId(null)}
            bond={open}
            character={openCharacter}
            onViewed={() => {
              useAppStore.getState().appendBond(open.id, [
                { id: uid('m'), from: 'system', kind: 'system', text: t('你看了 TA 的手机'), at: Date.now() },
              ]);
              // 她的好奇心也是关系（D-126）
              useAppStore.getState().creditBond(open.id, 'peekHis');
            }}
          />
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: Space.screen, gap: Space.inlineLoose, paddingBottom: 40 },
    empty: { textAlign: 'center', color: Romance.sub, fontSize: 13, marginTop: 40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.cardX },
    shellWrap: { width: 72, alignItems: 'center' },
    shell: {
      width: SHELL.width,
      height: SHELL.height,
      borderRadius: SHELL.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    shellBar: { width: 22, height: 3, borderRadius: Shape.radiusTail, backgroundColor: withAlpha('#FFFFFF', 0.8) },
    main: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub },
    actions: { gap: Space.inline, marginTop: 6 },
  })
);
