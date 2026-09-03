/**
 * 羁绊会话：加好友之后的家。会话顶部进「他的主页」。
 * 开门/离席已下线（D-046）：加好友即在线，TA 一直会回消息。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { InviteSheet, RedPacketSheet, type ExtraSheet } from '@/components/chat-extras';
import { PhoneSheet } from '@/components/his-phone';
import { LocationPicker, type PickedLocation } from '@/components/location-picker';
import { PhoneLock } from '@/components/phone-lock';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ARCHETYPE_LABEL } from '@/content/characters';
import { characterSecrets, unlockedSecretCount } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { callReady } from '@/lib/call';
import { applyReplyEffects } from '@/lib/chat';
import { describeAiError, generateReply, messageContextText } from '@/lib/engine';
import { updateBondMemory } from '@/lib/memory';
import { appointmentAtLabel, planTimeLabel } from '@/lib/appointments';
import { detectAppointment } from '@/lib/outing';
import { daysTogether, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { levelInfo, XP_PER_MESSAGE } from '@/lib/bond';
import { describeImage, transcribeVoice } from '@/lib/media';
import { shouldSendVoice, synthesizeVoice } from '@/lib/tts';
import type { ChatCard, ChatMessage, EngineReply } from '@/lib/types';
import type { Place } from '@/content/places';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sysMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'system', kind: 'system', text, at: Date.now() };
}

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

  const scope = { bondId: bond.id };

  const onSend = async (text: string, replyTo?: ReplyRef) => {
    useAppStore
      .getState()
      .appendBond(
        bond.id,
        [{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now(), replyTo }],
        { affinityDelta: XP_PER_MESSAGE }
      );
    await respond(text);
  };

  /** 「+」面板的卡片消息（D-081）：先上屏并计 XP（一次开口），再让 TA 按卡片内容回应；返回消息 id */
  const sendCard = async (card: ChatCard, prompt: string): Promise<string> => {
    const msg: ChatMessage = { id: uid('m'), from: 'me', kind: 'card', text: card.title, card, at: Date.now() };
    useAppStore.getState().appendBond(bond.id, [msg], { affinityDelta: XP_PER_MESSAGE });
    await respond(prompt);
    return msg.id;
  };

  /** 外出邀请（D-084 带时间）：卡片 → 立即成为一条带时间的约定（TA 一定答应），TA 用引擎回一句 */
  const invite = (place: Place, at: number) => {
    setSheet(null);
    const when = planTimeLabel(at);
    const pending = sendCard(
      { type: 'invite', title: `${when} · ${t(place.name)}`, subtitle: t(place.hook), placeId: place.id },
      `（她发来一张外出邀请：${appointmentAtLabel(at)} 去${place.name}。你答应下来，用你的口吻回她。）`
    );
    useAppStore.getState().addOutingPlan(character.id, place.id, { at, source: 'manual' });
    void pending;
  };

  /** 红包（D-084）：拆不拆由 TA 决定——回复带 [拆红包] 标记才算拆了（respond 里处理）；这轮没拆就标「TA 没拆」 */
  const sendRedPacket = (amount: number, note: string) => {
    setSheet(null);
    const card: ChatCard = { type: 'redpacket', title: `¥${amount.toFixed(2)}`, subtitle: note, amount };
    void (async () => {
      const id = await sendCard(
        card,
        `（她给你发了一个 ¥${amount.toFixed(2)} 的红包，留言「${note}」。按你的性格和你们的关系决定拆不拆：拆了就在回复最后单独一行写 [拆红包]；不拆就说说为什么或逗她。）`
      );
      const after = useAppStore.getState().bonds.find((b) => b.id === bond.id)?.messages.find((m) => m.id === id);
      if (after?.card && !after.card.claimed) {
        useAppStore.getState().patchMessage({ bondId: bond.id }, id, { card: { ...after.card, declined: true } });
      }
    })();
  };

  /** 位置（D-084）：真实地图选的点，卡片带坐标（气泡里一小块地图） */
  const sendLocation = (loc: PickedLocation) => {
    setSheet(null);
    void sendCard(
      { type: 'location', title: loc.title, subtitle: loc.subtitle, lat: loc.lat, lon: loc.lon },
      `（她发来了自己的位置：${loc.title}${loc.subtitle ? `，${loc.subtitle}` : ''}。）`
    );
  };

  /** 锁屏上的「问 TA 要密码」（D-084）：给 TA 发一条「想看你的手机」，TA 按性格决定给不给 */
  const askPasscode = () => {
    setSheet(null);
    const code = useAppStore.getState().ensurePhoneCode(bond.id);
    void sendCard(
      { type: 'phoneRequest', title: t('想看看你的手机') },
      `（她按了「问 TA 要密码」：${bond.nickname} 想看看你的手机。按你的性格和你们现在的亲密程度决定给不给：给就把密码 ${code} 告诉她，并在回复最后单独一行写 [解锁手机]；不给就说明为什么或逗她，不写标记。）`
    );
  };

  /** 她的语音（D-073）：先上屏，识别成文字后回填、计 XP，再让 TA 回应识别出的内容 */
  const onSendVoice = async (uri: string, durationMs: number) => {
    const msg: ChatMessage = {
      id: uid('m'),
      from: 'me',
      kind: 'voice',
      text: '',
      audioUri: uri,
      durationMs,
      at: Date.now(),
      mediaStatus: 'pending',
    };
    useAppStore.getState().appendBond(bond.id, [msg]);
    let transcript: string;
    try {
      transcript = await transcribeVoice(uri);
    } catch (e) {
      useAppStore.getState().patchMessage(scope, msg.id, { mediaStatus: 'failed' });
      useAppStore
        .getState()
        .appendBond(bond.id, [
          sysMsg(t('语音没识别出来，TA 没听到这条：{reason}', { reason: describeAiError(e) })),
        ]);
      return;
    }
    const done: ChatMessage = { ...msg, transcript, mediaStatus: undefined };
    useAppStore.getState().patchMessage(scope, msg.id, { transcript, mediaStatus: undefined });
    useAppStore.getState().appendBond(bond.id, [], { affinityDelta: XP_PER_MESSAGE });
    await respond(messageContextText(done));
  };

  /** 她的照片（D-073）：先上屏，视觉模型描述后回填、计 XP，再让 TA 回应 */
  const onSendImage = async (uri: string) => {
    const msg: ChatMessage = {
      id: uid('m'),
      from: 'me',
      kind: 'image',
      text: '',
      imageUri: uri,
      at: Date.now(),
      mediaStatus: 'pending',
    };
    useAppStore.getState().appendBond(bond.id, [msg]);
    let caption: string;
    try {
      caption = await describeImage(uri);
    } catch (e) {
      useAppStore.getState().patchMessage(scope, msg.id, { mediaStatus: 'failed' });
      useAppStore
        .getState()
        .appendBond(bond.id, [
          sysMsg(t('照片没看清，TA 没看到这条：{reason}', { reason: describeAiError(e) })),
        ]);
      return;
    }
    const done: ChatMessage = { ...msg, caption, mediaStatus: undefined };
    useAppStore.getState().patchMessage(scope, msg.id, { caption, mediaStatus: undefined });
    useAppStore.getState().appendBond(bond.id, [], { affinityDelta: XP_PER_MESSAGE });
    await respond(messageContextText(done));
  };

  /** TA 的回合：引擎回复 + 记忆后台更新。text 已是模型视角的文字（语音 / 照片经 messageContextText 包装） */
  const respond = async (text: string) => {
    setTyping(true);
    // 查手机（D-082）：TA 的手机密码第一次需要时才生成，记在这段羁绊上
    const phoneCode = useAppStore.getState().ensurePhoneCode(bond.id);
    const current = useAppStore.getState().bonds.find((b) => b.id === bond.id);
    let reply: EngineReply;
    try {
      reply = await generateReply({
        character,
        mode: 'bonded',
        bond: {
          name: bond.name,
          nickname: bond.nickname,
          affinity: bond.affinity,
          birthday: bond.birthday,
          createdAt: bond.createdAt,
          memory: current?.memory,
          phoneCode,
          phoneUnlocked: current?.phoneUnlocked,
        },
        me: meForCharacter(character.id),
        history: current?.messages ?? [],
        userText: text,
      });
    } catch (e) {
      // 模型调用失败：在会话里露出原因（D-069：没有脚本回落，错误要看得见）
      setTyping(false);
      useAppStore
        .getState()
        .appendBond(bond.id, [
          sysMsg(t('模型调用失败，TA 这条没回上：{reason}', { reason: describeAiError(e) })),
        ]);
      return;
    }
    await wait(700 + Math.min(1200, text.length * 40));
    setTyping(false);
    // TA 偶尔发语音（D-074）：只挑最后一条气泡、短句；她刚发过语音时更爱回语音。发出后预热合成，点开即播
    const herVoice = current?.messages[current.messages.length - 1]?.kind === 'voice';
    for (const [i, t] of reply.texts.entries()) {
      if (i > 0) await wait(500);
      const asVoice = i === reply.texts.length - 1 && shouldSendVoice(character, t, { herVoice });
      useAppStore
        .getState()
        .appendBond(bond.id, [
          { id: uid('m'), from: 'him', kind: asVoice ? 'voice' : 'text', text: t, at: Date.now() },
        ]);
      if (asVoice) void synthesizeVoice(t, character);
    }

    // 回复里的系统标记（D-082 解锁手机 / D-084 拆红包）→ 状态，与公共层共用（lib/chat.ts）
    applyReplyEffects(bond.id, reply);

    // 记忆库后台更新：每隔几轮提取长期事实 + 滚动摘要，失败静默（D-016）
    // （升级出画面已下线：聊天回归纯文本，D-037；升级系统提示仍在 store.appendBond）
    void updateBondMemory(bond.id);
    // 约定识别（D-079）：刚聊定了什么时候在哪见 → 记进日程（先关键词粗筛，命中才问模型）
    void detectAppointment(bond.id);
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

      <InviteSheet visible={sheet === 'invite'} onClose={() => setSheet(null)} onPick={invite} />
      <RedPacketSheet visible={sheet === 'redpacket'} onClose={() => setSheet(null)} onSend={sendRedPacket} />
      <LocationPicker visible={sheet === 'location'} onClose={() => setSheet(null)} onSend={sendLocation} />
      {/* 查手机（D-082/D-084）：没解锁是 iPhone 式锁屏（猜 / 问 TA 要），解锁后才是手机内容 */}
      <PhoneLock
        visible={sheet === 'phone' && !bond.phoneUnlocked}
        color={character.color}
        passcode={sheet === 'phone' ? useAppStore.getState().ensurePhoneCode(bond.id) : ''}
        onUnlock={() => useAppStore.getState().setPhoneUnlocked(bond.id)}
        onAsk={askPasscode}
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
