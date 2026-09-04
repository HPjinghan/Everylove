/**
 * 羁绊会话：加好友之后的家。会话顶部进「他的主页」。
 * 开门/离席已下线（D-046）：加好友即在线，TA 一直会回消息。
 * 回合走底座管线（D-086）：这里只管界面——她说的话交给 lib/chat，卡片交给各玩法的 send 函数；
 * 记忆 / 约定识别 / 偶尔发语音 / 回复暗号都是管线上的钩子，不在这个文件里。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { InviteSheet, RedPacketSheet, type ExtraSheet } from '@/components/chat-extras';
import { PhoneSheet } from '@/components/his-phone';
import { LocationPicker } from '@/components/location-picker';
import { PhoneLock } from '@/components/phone-lock';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ARCHETYPE_LABEL } from '@/content/characters';
import { characterSecrets, unlockedSecretCount } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { sysMsg } from '@/core/turn';
import { sendInvite } from '@/features/invite';
import { sendLocation } from '@/features/location';
import { askPasscode } from '@/features/phone-peek';
import { sendRedPacket } from '@/features/red-packet';
import { callReady } from '@/lib/call';
import { bondScope, sendImage, sendText, sendVoice } from '@/lib/chat';
import { daysTogether } from '@/lib/format';
import { t } from '@/lib/i18n';
import { levelInfo } from '@/lib/bond';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function BondScreen() {
  const { bondId } = useLocalSearchParams<{ bondId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === bondId));
  const [typing, setTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<ExtraSheet>(null);

  const messageCount = bond?.messages.length ?? 0;
  useEffect(() => {
    if (bond && bond.unread > 0) {
      useAppStore.getState().markBondRead(bond.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondId, messageCount]);

  if (!bond) return <Redirect href="/apps/messages" />;
  const character = findCharacter(bond.characterId);
  if (!character) return <Redirect href="/apps/messages" />;

  const scope = bondScope(bond.id);
  const ui = { typing: setTyping };

  const onSend = (text: string, replyTo?: ReplyRef) => void sendText(scope, text, { replyTo, ui });
  const onSendVoice = (uri: string, durationMs: number) => void sendVoice(scope, uri, durationMs, ui);
  const onSendImage = (uri: string) => void sendImage(scope, uri, ui);

  /** 「+」面板的玩法（D-081/D-084）：各自的 send 函数里带卡片、提示语与后续动作 */
  const onInvite = (place: Parameters<typeof sendInvite>[1], at: number) => {
    setSheet(null);
    void sendInvite(bond.id, place, at, ui);
  };
  const onRedPacket = (amount: number, note: string) => {
    setSheet(null);
    void sendRedPacket(bond.id, amount, note, ui);
  };
  const onLocation = (loc: Parameters<typeof sendLocation>[1]) => {
    setSheet(null);
    void sendLocation(bond.id, loc, ui);
  };
  const onAskPasscode = () => {
    setSheet(null);
    void askPasscode(bond.id, ui);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
        </Pressable>
        <Pressable style={styles.headerMain} onPress={() => setProfileOpen(true)}>
          <CharAvatar name={bond.name} color={character.color} size={36} characterId={character.id} />
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{bond.name}</Text>
            <Text style={styles.headerSub}>
              {t('羁绊')} LV{levelInfo(bond.affinity).level} · {t(levelInfo(bond.affinity).name)}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={14} color={Romance.faint} />
        </Pressable>
        {/* 打电话（D-077）：管线式通话，全屏 */}
        <Pressable
          onPress={() => {
            if (!callReady()) {
              Alert.alert(t('AI 不可用'), t('通话需要语音与聊天模型：在 .env.local 配置千帆 key，或登录后走服务端代理。'));
              return;
            }
            router.push({ pathname: '/call/[characterId]', params: { characterId: character.id } });
          }}
          hitSlop={10}
          style={{ padding: 4 }}>
          <MingCute name="phone" size={22} color="#3EB489" />
        </Pressable>
      </View>

      <ChatThread
        messages={bond.messages}
        color={character.color}
        name={bond.name}
        characterId={character.id}
        variant="line"
        typing={typing}
        onSend={onSend}
        onSendImage={onSendImage}
        onSendVoice={onSendVoice}
        onRecall={(m) => useAppStore.getState().recallMessage({ bondId: bond.id }, m.id)}
        onDelete={(m) => useAppStore.getState().deleteMessage({ bondId: bond.id }, m.id)}
        placeholder={t('和{name}说点什么…', { name: bond.name })}
        extras={[
          { key: 'invite', label: t('外出邀请'), icon: 'figure.walk', onPress: () => setSheet('invite') },
          { key: 'phone', label: t('查 TA 的手机'), icon: 'iphone', onPress: () => setSheet('phone') },
          { key: 'redpacket', label: t('红包'), icon: 'gift.fill', onPress: () => setSheet('redpacket') },
          { key: 'location', label: t('位置'), icon: 'mappin.and.ellipse', onPress: () => setSheet('location') },
        ]}
      />

      <InviteSheet visible={sheet === 'invite'} onClose={() => setSheet(null)} onPick={onInvite} />
      <RedPacketSheet visible={sheet === 'redpacket'} onClose={() => setSheet(null)} onSend={onRedPacket} />
      <LocationPicker visible={sheet === 'location'} onClose={() => setSheet(null)} onSend={onLocation} />
      {/* 查手机（D-082/D-084）：没解锁是 iPhone 式锁屏（猜 / 问 TA 要），解锁后才是手机内容 */}
      <PhoneLock
        visible={sheet === 'phone' && !bond.phoneUnlocked}
        color={character.color}
        passcode={sheet === 'phone' ? useAppStore.getState().ensurePhoneCode(bond.id) : ''}
        onUnlock={() => useAppStore.getState().setPhoneUnlocked(bond.id)}
        onAsk={onAskPasscode}
        onClose={() => setSheet(null)}
      />
      <PhoneSheet
        visible={sheet === 'phone' && !!bond.phoneUnlocked}
        onClose={() => setSheet(null)}
        bond={bond}
        character={character}
        onViewed={() => useAppStore.getState().appendBond(bond.id, [sysMsg(t('你看了 TA 的手机'))])}
      />

      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.profile}>
          <Pressable style={styles.profileClose} onPress={() => setProfileOpen(false)}>
            <IconSymbol name="xmark" size={18} color={Romance.sub} />
          </Pressable>
          <CharAvatar name={bond.name} color={character.color} size={84} characterId={character.id} />
          <Text style={styles.profileName}>{bond.name}</Text>
          <Text style={styles.profileIdentity}>
            {character.identity} · {character.styleLabel ?? ARCHETYPE_LABEL[character.archetype]}
          </Text>

          <View style={styles.profileStats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>LV{levelInfo(bond.affinity).level}</Text>
              <Text style={styles.statLabel}>{t(levelInfo(bond.affinity).name)}</Text>
              <View style={styles.lvBarTrack}>
                <View
                  style={[styles.lvBarFill, { width: `${levelInfo(bond.affinity).ratio * 100}%` }]}
                />
              </View>
              <Text style={styles.lvBarText}>
                {levelInfo(bond.affinity).max
                  ? 'MAX'
                  : `${levelInfo(bond.affinity).gained}/${levelInfo(bond.affinity).need}`}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{daysTogether(bond.createdAt)}</Text>
              <Text style={styles.statLabel}>{t('在一起的天数')}</Text>
            </View>
          </View>

          <View style={styles.profileRows}>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('TA 叫你')}</Text>
              <Text style={styles.profileRowValue}>「{bond.nickname}」</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('纪念日')}</Text>
              <Text style={styles.profileRowValue}>
                {new Date(bond.createdAt).toLocaleDateString('zh-CN')} {t('交换联系方式')}
              </Text>
            </View>
            {bond.birthday && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t('你的生日')}</Text>
                <Text style={styles.profileRowValue}>{bond.birthday}</Text>
              </View>
            )}
            {characterSecrets(character).length > 0 && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t('TA 的秘密')}</Text>
                <Text style={styles.profileRowValueDim}>
                  {t('已看见')} {unlockedSecretCount(levelInfo(bond.affinity).level, characterSecrets(character).length)}/
                  {characterSecrets(character).length}
                </Text>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('TA 的故事')}</Text>
              <Text style={styles.profileRowValueDim}>{t('主线连载 · 敬请期待')}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('相册')}</Text>
              <Text style={styles.profileRowValueDim}>{t('正在慢慢变厚')}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Romance.line,
    },
    headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerText: { flex: 1 },
    headerName: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    headerSub: { fontSize: 11, color: Romance.accent },
    banner: {
      alignSelf: 'center',
      backgroundColor: Romance.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    bannerText: { fontSize: 11, color: Romance.accent },
    profile: { flex: 1, backgroundColor: Romance.bg, alignItems: 'center', paddingTop: 40 },
    profileClose: { position: 'absolute', top: 16, right: 16, padding: 8 },
    profileName: { fontSize: 24, fontWeight: '700', color: Romance.ink, marginTop: 14 },
    profileIdentity: { fontSize: 13, color: Romance.sub, marginTop: 4 },
    profileStats: { flexDirection: 'row', gap: 14, marginTop: 24 },
    stat: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingVertical: 14,
      alignItems: 'center',
      minWidth: 130,
    },
    statNum: { fontSize: 24, fontWeight: '700', color: Romance.accent },
    lvBarTrack: {
      width: 96,
      height: 6,
      borderRadius: 3,
      backgroundColor: Romance.accentSoft,
      marginTop: 8,
      overflow: 'hidden',
    },
    lvBarFill: { height: '100%', borderRadius: 3, backgroundColor: Romance.accent },
    lvBarText: { fontSize: 10, color: Romance.faint, marginTop: 4 },
    statLabel: { fontSize: 11, color: Romance.sub, marginTop: 4 },
    profileRows: { alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 24, gap: 10 },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    profileRowLabel: { fontSize: 13, color: Romance.sub },
    profileRowValue: { fontSize: 13, color: Romance.ink, fontWeight: '500' },
    profileRowValueDim: { fontSize: 13, color: Romance.faint },
  })
);
