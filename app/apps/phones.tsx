/**
 * 查手机（D-085）：桌面入口——所有缔结的 TA 各一部手机可选（同 D-082/D-084 的锁屏 / 内容），
 * 还能反过来「让 TA 看我的手机」：TA 翻记事本与她和别人的聊天，然后给她发消息（lib/chat.ts peekMyPhone）。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { PhoneSheet } from '@/components/his-phone';
import { PhoneLock } from '@/components/phone-lock';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { peekMyPhone, sendCardAndRespond } from '@/lib/chat';
import { aiRouteSync } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function PhonesScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const [openId, setOpenId] = useState<string | null>(null);
  const [peeking, setPeeking] = useState<string | null>(null);

  const open = bonds.find((b) => b.id === openId);
  const openCharacter = open ? findCharacter(open.characterId) : undefined;

  const askPasscode = (bondId: string) => {
    const bond = bonds.find((b) => b.id === bondId);
    if (!bond) return;
    setOpenId(null);
    const code = useAppStore.getState().ensurePhoneCode(bond.id);
    void sendCardAndRespond(
      bond.id,
      { type: 'phoneRequest', title: t('想看看你的手机') },
      `（她按了「问 TA 要密码」：${bond.nickname} 想看看你的手机。按你的性格和你们现在的亲密程度决定给不给：给就把密码 ${code} 告诉她，并在回复最后单独一行写 [解锁手机]；不给就说明为什么或逗她，不写标记。）`
    );
    router.push({ pathname: '/bond/[bondId]', params: { bondId: bond.id } });
  };

  const invitePeek = (bondId: string) => {
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
                <Pressable style={styles.phone} onPress={() => setOpenId(b.id)}>
                  <View style={[styles.phoneShell, { backgroundColor: c.color }]}>
                    <CharAvatar name={b.name} color={c.color} size={40} characterId={c.id} />
                    <View style={styles.phoneBar} />
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {b.name}
                  </Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable style={styles.btn} onPress={() => setOpenId(b.id)}>
                    <Text style={styles.btnText}>{t('看 TA 的手机')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnPrimary, peeking === b.id && styles.btnDim]}
                    disabled={peeking === b.id}
                    onPress={() => invitePeek(b.id)}>
                    <Text style={[styles.btnText, styles.btnPrimaryText]}>
                      {peeking === b.id ? t('TA 在看…') : t('让 TA 看我的手机')}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {open && openCharacter ? (
        <>
          <PhoneLock
            visible={!open.phoneUnlocked}
            color={openCharacter.color}
            passcode={useAppStore.getState().ensurePhoneCode(open.id)}
            onUnlock={() => useAppStore.getState().setPhoneUnlocked(open.id)}
            onAsk={() => askPasscode(open.id)}
            onClose={() => setOpenId(null)}
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
    list: { padding: Space.screen, gap: Space.inlineLoose, paddingBottom: 40 },
    empty: { textAlign: 'center', color: Romance.sub, fontSize: 13, marginTop: 40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.cardX },
    phone: { alignItems: 'center', width: 72 },
    phoneShell: {
      width: 56,
      height: 92,
      borderRadius: 10,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    phoneBar: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
    name: { fontFamily: Fonts.label, fontSize: 12, color: Romance.ink, marginTop: 6 },
    actions: { flex: 1, gap: Space.inline },
    btn: {
      borderRadius: Shape.radius,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: Romance.bg,
    },
    btnPrimary: { backgroundColor: Romance.accent, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    btnDim: { opacity: 0.5 },
    btnText: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    btnPrimaryText: { color: '#FFFFFF' },
  })
);
