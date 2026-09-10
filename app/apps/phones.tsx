/**
 * 查手机（D-085；D-100 纸面；D-110 一部真的手机）：桌面入口——所有缔结的 TA 各一部手机可选（锁屏 → 角色色桌面 → 点 App 进去看，components/his-phone.tsx），
 * 还能反过来「让 TA 看我的手机」：先弹底部确认卡（说明 TA 会读到什么、看完会发消息、不可撤回），确认后
 * TA 翻记事本与她和别人的聊天，然后给她发消息（lib/chat.ts peekMyPhone）。
 * 锁屏上「问 TA 要密码」不再跳回会话：卡片照发，TA 的回复在锁屏上原地显示（components/phone-lock.tsx）。
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { PhoneSheet } from '@/components/his-phone';
import { PhoneLock } from '@/components/phone-lock';
import { Shape, Space } from '@/constants/design';
import { Romance, themed, withAlpha } from '@/constants/theme';
import { askPasscode as askHisPasscode } from '@/features/phone-peek';
import { peekMyPhone } from '@/lib/chat';
import { aiRouteSync } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 手机壳 56×92、r10：唯一一处不是 6 的圆角——它画的是一部手机的外形，不是卡片 */
const SHELL = { width: 56, height: 92, radius: 10 } as const;

export default function PhonesScreen() {
  const insets = useSafeAreaInsets();
  const bonds = useAppStore((s) => s.bonds);
  const [openId, setOpenId] = useState<string | null>(null);
  const [peeking, setPeeking] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const open = bonds.find((b) => b.id === openId);
  const openCharacter = open ? findCharacter(open.characterId) : undefined;
  const confirming = bonds.find((b) => b.id === confirmId);

  const invitePeek = (bondId: string) => {
    setConfirmId(null);
    if (aiRouteSync() === 'none') {
      Alert.alert(t('AI 不可用'), t('通话需要语音与聊天模型：在 .env.local 配置千帆 key，或登录后走服务端代理。'));
      return;
    }
    setPeeking(bondId);
    void peekMyPhone(bondId).finally(() => setPeeking(null));
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

      {/* 二次确认（D-100 交互改动 6）：隐私与数据说明，确认后才 peekMyPhone */}
      <Modal visible={!!confirming} transparent animationType="fade" onRequestClose={() => setConfirmId(null)}>
        <Pressable style={[styles.overlay, { paddingBottom: insets.bottom + Space.screen }]} onPress={() => setConfirmId(null)}>
          <Pressable onPress={() => {}}>
            <Card padded={false} style={styles.confirm}>
              <Text style={styles.confirmTitle}>{t('让{name}看你的手机？', { name: confirming?.name ?? '' })}</Text>
              <Text style={styles.confirmBody}>
                {t('TA 会读到：记事本的全部内容、日历里的安排、你和其他人最近的聊天。看完 TA 会给你发消息。这一步不能撤回。')}
              </Text>
              <View style={styles.confirmActions}>
                <Button label={t('取消')} variant="paper" size="md" style={styles.flex} onPress={() => setConfirmId(null)} />
                <Button
                  label={t('让 TA 看')}
                  variant="primary"
                  size="md"
                  style={styles.flex}
                  onPress={() => confirming && invitePeek(confirming.id)}
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      {open && openCharacter ? (
        <>
          <PhoneLock
            visible={!open.phoneUnlocked}
            color={openCharacter.color}
            passcode={useAppStore.getState().ensurePhoneCode(open.id)}
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
            onViewed={() =>
              useAppStore.getState().appendBond(open.id, [
                { id: uid('m'), from: 'system', kind: 'system', text: t('你看了 TA 的手机'), at: Date.now() },
              ])
            }
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
    shellBar: { width: 22, height: 3, borderRadius: Shape.radiusTail, backgroundColor: 'rgba(255,255,255,0.8)' },
    main: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub },
    actions: { gap: Space.inline, marginTop: 6 },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: Space.screen,
      backgroundColor: withAlpha(Romance.ink, 0.45),
    },
    confirm: { padding: 16 },
    confirmTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    confirmBody: { fontSize: 13, lineHeight: 20, color: Romance.sub, marginTop: 8 },
    confirmActions: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: 16 },
  })
);
