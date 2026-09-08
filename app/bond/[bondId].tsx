/**
 * 羁绊会话（D-100 纸面）：加好友之后的家。
 * 顶栏自绘：‹、头像 36、名 17/600、「羁绊 LVn · 阶段 ›」12/500 primary（整块点开「TA 的主页」）、右侧只留电话；下沿 1.5px ink。
 * LV1 首次进入插一条「+」面板预告（白底 accent 字，只一次，bond.hintPlusSeen）。
 * 「TA 的主页」= 原 profile Modal 扩展：统计卡 + 三个动作图块（电话 / 查手机 / 约 TA）+ 信息卡（Card + Divider 分区）。
 * 开门/离席已下线（D-046）：加好友即在线，TA 一直会回消息。
 * 回合走底座管线（D-086）：这里只管界面——她说的话交给 lib/chat，卡片交给各玩法的 send 函数；
 * 记忆 / 约定识别 / 偶尔发语音 / 回复暗号都是管线上的钩子，不在这个文件里。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Divider } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { InviteSheet, RedPacketSheet, type ExtraSheet } from '@/components/chat-extras';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { PhoneSheet } from '@/components/his-phone';
import { LocationPicker } from '@/components/location-picker';
import { MingCute, type MingCuteName } from '@/components/mingcute';
import { PhoneLock } from '@/components/phone-lock';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { ARCHETYPE_LABEL } from '@/content/characters';
import { characterSecrets, unlockedSecretCount } from '@/content/prompts';
import { sysMsg } from '@/core/turn';
import { sendInvite } from '@/features/invite';
import { sendLocation } from '@/features/location';
import { askPasscode } from '@/features/phone-peek';
import { sendRedPacket } from '@/features/red-packet';
import { levelInfo } from '@/lib/bond';
import { callReady } from '@/lib/call';
import { bondScope, sendImage, sendText, sendVoice } from '@/lib/chat';
import { daysTogether } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

/** Fredoka 只给数字与拉丁（D-100）：生日这类可能带中文的值回落系统字体 */
const LATIN = /^[\x20-\x7E]*$/;

/** 主页的动作图块：60 白底无描边、图标 ink 30、标签 12 */
function ActionTile({ icon, label, onPress }: { icon: MingCuteName; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.tileBox}>
        <MingCute name={icon} size={Space.iconTile} color={Romance.ink} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>{children}</View>
    </View>
  );
}

export default function BondScreen() {
  const { bondId } = useLocalSearchParams<{ bondId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === bondId));
  const [typing, setTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sheet, setSheet] = useState<ExtraSheet>(null);
  /** 主页里点了动作：等主页这张 sheet 收完再开下一层（iOS 上两个 Modal 不能同时切换） */
  const afterProfile = useRef<(() => void) | null>(null);

  const messageCount = bond?.messages.length ?? 0;
  useEffect(() => {
    if (bond && bond.unread > 0) {
      useAppStore.getState().markBondRead(bond.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondId, messageCount]);

  // 「+」面板预告（D-100）：LV1 第一次进来插一条白底 accent 字的提示，只出现一次
  useEffect(() => {
    if (!bond || bond.hintPlusSeen || levelInfo(bond.affinity).level !== 1) return;
    const store = useAppStore.getState();
    store.appendBond(bond.id, [{ ...sysMsg(t('试试「+」里的外出邀请，把相处从屏幕里拿出来')), tone: 'hint' }]);
    store.markBondHintSeen(bond.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondId]);

  if (!bond) return <Redirect href="/apps/messages" />;
  const character = findCharacter(bond.characterId);
  if (!character) return <Redirect href="/apps/messages" />;

  const scope = bondScope(bond.id);
  const ui = { typing: setTyping };
  const myBirthday = meForCharacter(character.id)?.birthday ?? bond.birthday;
  const lv = levelInfo(bond.affinity);
  const secretCount = characterSecrets(character).length;
  const anniversary = new Date(bond.createdAt);

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
  /** 问 TA 要密码（D-100）：锁屏不关，TA 的回复原地显示在锁屏里（components/phone-lock 订阅 bondId） */
  const onAskPasscode = () => void askPasscode(bond.id, ui);

  /** 打电话（D-077）：管线式通话，全屏 */
  const startCall = () => {
    if (!callReady()) {
      Alert.alert(t('AI 不可用'), t('通话需要语音与聊天模型：在 .env.local 配置千帆 key，或登录后走服务端代理。'));
      return;
    }
    router.push({ pathname: '/call/[characterId]', params: { characterId: character.id } });
  };

  /** 主页三个动作：先收起主页，收完再做 */
  const fromProfile = (fn: () => void) => {
    afterProfile.current = fn;
    setProfileOpen(false);
  };

  const infoRows: ReactNode[] = [
    <InfoRow key="nick" label={t('TA 叫你')}>
      <Text style={styles.infoValue}>「{bond.nickname}」</Text>
    </InfoRow>,
    <InfoRow key="anniversary" label={t('纪念日')}>
      <Text style={styles.infoNum}>
        {anniversary.getMonth() + 1}/{anniversary.getDate()}
      </Text>
      <Text style={styles.infoValue}> {t('交换联系方式')}</Text>
    </InfoRow>,
  ];
  if (myBirthday) {
    infoRows.push(
      <InfoRow key="birthday" label={t('你的生日')}>
        <Text style={LATIN.test(myBirthday) ? styles.infoNum : styles.infoValue}>{myBirthday}</Text>
      </InfoRow>
    );
  }
  if (secretCount > 0) {
    infoRows.push(
      <InfoRow key="secrets" label={t('TA 的秘密')}>
        <Text style={styles.infoValueDim}>{t('已看见')} </Text>
        <Text style={styles.infoNumDim}>
          {unlockedSecretCount(lv.level, secretCount)}/{secretCount}
        </Text>
      </InfoRow>
    );
  }
  infoRows.push(
    <InfoRow key="story" label={t('TA 的故事')}>
      <Text style={styles.infoValueDim}>{t('主线连载 · 敬请期待')}</Text>
    </InfoRow>,
    <InfoRow key="album" label={t('相册')}>
      <Text style={styles.infoValueDim}>{t('正在慢慢变厚')}</Text>
    </InfoRow>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <IconSymbol name="chevron.left" size={20} color={Romance.ink} />
        </Pressable>
        <Pressable style={styles.headerMain} onPress={() => setProfileOpen(true)}>
          <CharAvatar name={bond.name} color={character.color} size={Space.avatar.row} characterId={character.id} />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {bond.name}
            </Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSub}>{t('羁绊')} </Text>
              <Text style={styles.headerLv}>LV{lv.level}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {' '}· {t(lv.name)} ›
              </Text>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={startCall} hitSlop={10} style={styles.headerAction}>
          <MingCute name="phoneSimple" size={22} color={Romance.ink} />
        </Pressable>
      </View>

      <ChatThread
        messages={bond.messages}
        color={character.color}
        name={bond.name}
        characterId={character.id}
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
        bondId={bond.id}
        characterId={character.id}
        name={bond.name}
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

      {/* TA 的主页（D-100）：统计卡 → 三个动作图块 → 信息卡 */}
      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileOpen(false)}
        onDismiss={() => {
          const fn = afterProfile.current;
          afterProfile.current = null;
          fn?.();
        }}>
        <View style={styles.profile}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileTitle}>{t('TA 的主页')}</Text>
            <Pressable style={styles.profileClose} onPress={() => setProfileOpen(false)} hitSlop={10}>
              <IconSymbol name="xmark" size={18} color={Romance.sub} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.profileBody}>
            <CharAvatar name={bond.name} color={character.color} size={84} characterId={character.id} />
            <Text style={styles.profileName}>{bond.name}</Text>
            <Text style={styles.profileIdentity}>
              {character.identity} · {character.styleLabel ?? ARCHETYPE_LABEL[character.archetype]}
            </Text>

            <View style={styles.stats}>
              <Card style={styles.stat}>
                <Text style={styles.statNum}>LV{lv.level}</Text>
                <Text style={styles.statLabel}>{t(lv.name)}</Text>
                <View style={styles.lvTrack}>
                  <View style={[styles.lvFill, { width: `${lv.ratio * 100}%` }]} />
                </View>
                <Text style={styles.lvText}>{lv.max ? 'MAX' : `${lv.gained}/${lv.need}`}</Text>
              </Card>
              <Card style={[styles.stat, styles.statCenter]}>
                <Text style={styles.statNum}>{daysTogether(bond.createdAt)}</Text>
                <Text style={styles.statLabel}>{t('在一起的天数')}</Text>
              </Card>
            </View>

            <View style={styles.tiles}>
              <ActionTile icon="phoneSimple" label={t('电话')} onPress={() => fromProfile(startCall)} />
              <ActionTile icon="phoneEye" label={t('查手机')} onPress={() => fromProfile(() => setSheet('phone'))} />
              <ActionTile icon="location" label={t('约 TA')} onPress={() => fromProfile(() => setSheet('invite'))} />
            </View>

            <Card padded={false} style={styles.info}>
              {infoRows.flatMap((row, i) => (i ? [<Divider key={`divider-${i}`} />, row] : [row]))}
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    // 顶栏：透底、只有 1.5px 墨色下沿
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.screen,
      paddingTop: 6,
      paddingBottom: 10,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    back: { paddingRight: 2 },
    headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    headerText: { flex: 1 },
    headerName: { fontSize: 17, fontWeight: '600', color: Romance.ink },
    headerSubRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3 },
    headerSub: { fontSize: 12, fontWeight: '500', color: Romance.accent, flexShrink: 1 },
    headerLv: { fontFamily: Fonts.label, fontSize: 12, color: Romance.accent },
    headerAction: { padding: 4 },
    // TA 的主页
    profile: { flex: 1, backgroundColor: Romance.bg },
    profileHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 14,
      paddingBottom: 10,
      paddingHorizontal: 16,
    },
    profileTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    profileClose: { position: 'absolute', right: 16, top: 14 },
    profileBody: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
    profileName: { fontSize: 24, fontWeight: '600', color: Romance.ink, marginTop: 14 },
    profileIdentity: { fontSize: 13, color: Romance.sub, marginTop: 4 },
    stats: { flexDirection: 'row', gap: Space.screen, marginTop: Space.tileGap, alignSelf: 'stretch' },
    stat: { flex: 1, padding: 14, alignItems: 'center' },
    statCenter: { justifyContent: 'center' },
    statNum: { fontFamily: Fonts.labelBold, fontSize: 24, color: Romance.accent },
    statLabel: { fontSize: 11, color: Romance.sub, marginTop: 4 },
    lvTrack: {
      width: 96,
      height: 6,
      borderRadius: Shape.radiusTail,
      backgroundColor: Romance.accentSoft,
      marginTop: 8,
      overflow: 'hidden',
    },
    lvFill: { height: '100%', backgroundColor: Romance.accent },
    lvText: { fontFamily: Fonts.label, fontSize: 10, color: Romance.sub, marginTop: 4 },
    tiles: { flexDirection: 'row', justifyContent: 'center', gap: Space.tileGapLoose, marginTop: Space.tileGap },
    tile: { alignItems: 'center', gap: 6 },
    tileBox: {
      width: Space.appTile,
      height: Space.appTile,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: { fontSize: 12, fontWeight: '500', color: Romance.ink },
    info: { alignSelf: 'stretch', marginTop: Space.tileGap },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Space.cardX,
      paddingVertical: 12,
    },
    infoLabel: { fontSize: 13, color: Romance.sub },
    infoValueRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
    infoValue: { fontSize: 13, fontWeight: '500', color: Romance.ink },
    infoValueDim: { fontSize: 13, fontWeight: '500', color: Romance.faint },
    infoNum: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    infoNumDim: { fontFamily: Fonts.label, fontSize: 13, color: Romance.faint },
  })
);
