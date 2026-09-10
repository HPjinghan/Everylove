/**
 * TA 的手机（解锁后的内容，D-082/D-085；D-110 改成一部真的手机）：
 * 打开 = 一块角色色的桌面（同锁屏：角色色通底 + 白 8% 菱格、Fredoka 时钟），上面摆着 TA 的 App：
 * Message / 通讯录 / 记事本 / 日历 / 相册——点进去看，左上角 ‹ 回桌面。
 * TA 的手机里不只有她：第一次打开时生成「身边的人」（lib/circle.ts：家人 / 朋友 / 同事 + 和其中几个人的近期聊天），
 * 通讯录里有他们、Message 里有和他们的对话；她的那一格是真实的羁绊会话（TA 视角：TA 的话在右边）。
 * 记事本 = TA 自己的日子（米色纸 NOTE_PAPER）+ 锁着的页（隐藏设定）；日历 = 约定 + TA 的生日；相册 = 立绘 + 这个 TA 的照片。
 * 打开即触发一次记事本补写（lib/his-notes.ts），第一次进来不会是空本子。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute, type MingCuteName } from '@/components/mingcute';
import { DiamondBackground } from '@/components/paper-bg';
import { Polaroid } from '@/components/polaroid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { placeById } from '@/content/places';
import { characterSecrets, messageContextText, unlockedSecretCount } from '@/content/prompts';
import { NOTE_PAPER, Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { planTimeLabel } from '@/lib/appointments';
import { levelInfo } from '@/lib/bond';
import { ensureCircle } from '@/lib/circle';
import { clockTime, timeAgo } from '@/lib/format';
import { portraitFor } from '@/lib/imagegen';
import { deliverDueHisNotes } from '@/lib/his-notes';
import { getLang, localeOf, t } from '@/lib/i18n';
import type { Bond, Character, CircleLine } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
/** 相册里的拍立得宽度 */
const SHOT_WIDTH = 150;
/** 桌面图块：60 白底 r6（同主页），四列 */
const TILE = 60;
/** 她那一格在 Message / 通讯录里的 id */
const HER = 'her';

type PhoneApp = 'messages' | 'contacts' | 'notes' | 'calendar' | 'album';

const APPS: { id: PhoneApp; label: string; icon: MingCuteName }[] = [
  { id: 'messages', label: 'Message', icon: 'chat' },
  { id: 'contacts', label: '通讯录', icon: 'contacts' },
  { id: 'notes', label: '记事本', icon: 'notebook' },
  { id: 'calendar', label: '日历', icon: 'calendar' },
  { id: 'album', label: '相册', icon: 'album' },
];

function dayParts(at: number): { md: string; wd: string } {
  const d = new Date(at);
  return { md: `${d.getMonth() + 1}/${d.getDate()}`, wd: t('周{d}', { d: t(WEEKDAY[d.getDay()]) }) };
}

function dateLine(d: Date): string {
  try {
    return d.toLocaleDateString(localeOf(getLang()), { month: 'long', day: 'numeric', weekday: 'long' });
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

/** 一个人的首字头像（身边的人没有立绘）：line 底 ink 衬线字 */
function InitialAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.initial, { width: size, height: size }]}>
      <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export function PhoneSheet({
  visible,
  onClose,
  bond,
  character,
  onViewed,
}: {
  visible: boolean;
  onClose: () => void;
  bond: Bond;
  character: Character;
  /** 内容真的展开给她看时 */
  onViewed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const album = useAppStore((s) => s.album);
  const storedPortrait = useAppStore((s) => s.portraits[character.id]);
  // 立绘：她重画的优先，种子角色回落内置（D-092）；相册要 URI 字符串
  const portrait = storedPortrait ?? portraitFor(character.id);
  const plans = useAppStore((s) => s.outingPlans);
  const [app, setApp] = useState<PhoneApp | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [circleReady, setCircleReady] = useState(!!bond.circle?.length);
  const viewed = useRef(false);
  useEffect(() => {
    if (!visible) {
      viewed.current = false;
      return;
    }
    if (!viewed.current) {
      viewed.current = true;
      onViewed?.();
      // 记事本补写：到点的 / 还一条没有的，这会儿写上
      void deliverDueHisNotes();
      // 身边的人（D-110）：第一次打开时生成一次
      void ensureCircle(bond.id).then(() => setCircleReady(true));
    }
  }, [visible, onViewed, bond.id]);

  // 日历「今天」按打开这张表时的时间算（渲染里不直接叫 Date.now）
  const [now] = useState(() => Date.now());
  const notes = [...(bond.notes ?? [])].sort((a, b) => b.at - a.at);
  const secrets = characterSecrets(character);
  const unlockedSecrets = unlockedSecretCount(levelInfo(bond.affinity).level, secrets.length);
  const circle = bond.circle ?? [];
  const circleChats = bond.circleChats ?? {};

  // 日历：和她的约定 + TA 的生日（只记安排与纪念日，D-090；TA 经历的事在记事本里）
  const calendar = useMemo(() => {
    const out: { at: number; text: string; timed: boolean }[] = [];
    for (const p of plans) {
      if (p.characterId !== character.id || !p.at) continue;
      const place = placeById(p.placeId);
      if (place) out.push({ at: p.at, text: t('和{name}去{place}', { name: bond.nickname, place: t(place.name) }), timed: true });
    }
    if (character.birthday && /^\d{1,2}-\d{1,2}$/.test(character.birthday)) {
      const [mm, dd] = character.birthday.split('-').map(Number);
      const y = new Date(now).getFullYear();
      let bd = new Date(y, mm - 1, dd).getTime();
      if (bd < now - 86400_000) bd = new Date(y + 1, mm - 1, dd).getTime();
      out.push({ at: bd, text: t('我的生日'), timed: false });
    }
    return out.sort((a, b) => a.at - b.at).filter((e) => e.at > now - 86400_000).slice(0, 8);
  }, [plans, character, bond.nickname, now]);

  // 她的会话（TA 视角）：非系统、可进上下文的最近 40 条
  const herMessages = bond.messages.filter((m) => m.from !== 'system' && !m.recalled && messageContextText(m)).slice(-40);
  const herLines: CircleLine[] = herMessages.map((m) => ({ from: m.from === 'him' ? 'him' : 'them', text: messageContextText(m), at: m.at }));

  // Message 列表：她 + 有聊天的身边人，按最后一句时间倒序
  const conversations = useMemo(() => {
    const rows: { id: string; name: string; lines: CircleLine[]; personId?: string }[] = [{ id: HER, name: bond.nickname, lines: herLines }];
    for (const p of circle) {
      const lines = circleChats[p.id];
      if (lines?.length) rows.push({ id: p.id, name: p.name, lines, personId: p.id });
    }
    return rows.sort((a, b) => (b.lines.at(-1)?.at ?? 0) - (a.lines.at(-1)?.at ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bond.nickname, bond.messages, circle, circleChats]);

  const photos = [
    ...(portrait ? [{ id: 'portrait', uri: portrait, caption: undefined as string | undefined }] : []),
    ...album.filter((p) => p.characterId === character.id).map((p) => ({ id: p.id, uri: p.uri, caption: p.caption })),
  ];

  const close = () => {
    setApp(null);
    setThread(null);
    onClose();
  };
  const back = () => {
    if (thread) setThread(null);
    else setApp(null);
  };

  const appTitle = (a: PhoneApp) => {
    const item = APPS.find((x) => x.id === a)!;
    return item.label === 'Message' ? 'Message' : t(item.label);
  };
  const currentThread = thread ? conversations.find((c) => c.id === thread) : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      {app === null ? (
        /* ── 桌面：角色色通底 + 白 8% 菱格（同锁屏），TA 的 App 摆在上面 ── */
        <View style={[styles.home, { backgroundColor: character.color, paddingTop: insets.top }]}>
          <DiamondBackground color="#FFFFFF" alpha={0.08} />
          <View style={styles.homeTop}>
            <Pressable onPress={close} hitSlop={12} style={styles.homeClose}>
              <MingCute name="close" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.homeOwner}>
              <CharAvatar name={bond.name} color={withAlpha('#FFFFFF', 0.18)} size={30} characterId={character.id} />
              <Text style={styles.homeOwnerName}>{t('{name} 的手机', { name: bond.name })}</Text>
            </View>
          </View>
          <Text style={styles.clock}>{clockTime(now)}</Text>
          <Text style={styles.clockDate}>{dateLine(new Date(now))}</Text>
          <View style={styles.grid}>
            {APPS.map((a) => {
              const badge = a.id === 'messages' ? conversations.filter((c) => c.lines.length).length : 0;
              return (
                <Pressable key={a.id} style={styles.tileWrap} onPress={() => setApp(a.id)}>
                  <View style={styles.tile}>
                    <MingCute name={a.icon} size={Space.iconTile} color={Romance.ink} />
                    {badge > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.tileLabel, a.label === 'Message' && styles.tileLabelLatin]}>{a.label === 'Message' ? 'Message' : t(a.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        /* ── App 内页：纸面底 + 顶栏 ‹ ── */
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable onPress={back} hitSlop={10} style={styles.back}>
              <IconSymbol name="chevron.left" size={16} color={Romance.ink} />
              <Text style={styles.backText}>{thread ? appTitle(app) : t('桌面')}</Text>
            </Pressable>
            <Text style={[styles.title, app === 'messages' && !thread && styles.titleLatin]} numberOfLines={1}>
              {thread ? (currentThread?.name ?? '') : appTitle(app)}
            </Text>
            <Pressable onPress={close} hitSlop={10} style={styles.right}>
              <MingCute name="close" size={18} color={Romance.sub} />
            </Pressable>
          </View>

          {app === 'messages' && !thread ? (
            <ScrollView contentContainerStyle={styles.listBody}>
              {conversations.map((c) => {
                const last = c.lines.at(-1);
                return (
                  <Pressable key={c.id} onPress={() => setThread(c.id)}>
                    <Card style={styles.convRow}>
                      {c.id === HER ? (
                        <View style={styles.herAvatar}>
                          <Text style={styles.herAvatarText}>{c.name.slice(0, 1)}</Text>
                        </View>
                      ) : (
                        <InitialAvatar name={c.name} />
                      )}
                      <View style={styles.convText}>
                        <View style={styles.convHead}>
                          <Text style={styles.convName} numberOfLines={1}>
                            {c.name}
                            {c.id === HER ? <Text style={styles.convTag}>  {t('恋人')}</Text> : null}
                          </Text>
                          {last ? <Text style={styles.time}>{timeAgo(last.at)}</Text> : null}
                        </View>
                        <Text style={styles.convPreview} numberOfLines={1}>
                          {last ? `${last.from === 'him' ? t('我') : c.name}：${last.text}` : t('…')}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
              {!circleReady ? <Text style={styles.empty}>{t('…')}</Text> : null}
            </ScrollView>
          ) : null}

          {app === 'messages' && currentThread ? (
            <ScrollView contentContainerStyle={styles.threadBody}>
              {currentThread.lines.length ? (
                currentThread.lines.map((l, i) => (
                  <View key={i} style={[styles.bubbleRow, l.from === 'him' ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                    <View style={[styles.bubble, l.from === 'him' ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, l.from === 'him' && styles.bubbleTextMine]}>{l.text}</Text>
                    </View>
                    <Text style={styles.bubbleTime}>{clockTime(l.at)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>{t('…')}</Text>
              )}
            </ScrollView>
          ) : null}

          {app === 'contacts' ? (
            <ScrollView contentContainerStyle={styles.listBody}>
              <Card style={styles.convRow}>
                <View style={styles.herAvatar}>
                  <Text style={styles.herAvatarText}>{bond.nickname.slice(0, 1)}</Text>
                </View>
                <View style={styles.convText}>
                  <Text style={styles.convName}>{bond.nickname}</Text>
                  <Text style={styles.convPreview}>{t('恋人')}</Text>
                </View>
              </Card>
              {circle.map((p) => (
                <Card key={p.id} style={styles.convRow}>
                  <InitialAvatar name={p.name} />
                  <View style={styles.convText}>
                    <Text style={styles.convName}>
                      {p.name}
                      <Text style={styles.convTag}>  {p.relation}</Text>
                    </Text>
                    {p.note ? (
                      <Text style={styles.convPreview} numberOfLines={1}>
                        {p.note}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}
              {!circleReady ? <Text style={styles.empty}>{t('…')}</Text> : null}
            </ScrollView>
          ) : null}

          {app === 'notes' ? (
            <ScrollView contentContainerStyle={styles.listBody}>
              <View style={styles.note}>
                {notes.length ? (
                  notes.slice(0, 12).map((n) => (
                    <View key={n.id} style={styles.noteItem}>
                      <Text style={styles.noteTime}>{timeAgo(n.at)}</Text>
                      <Text style={styles.noteLine}>{n.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.empty}>{t('…')}</Text>
                )}
                {secrets.map((s, i) =>
                  i < unlockedSecrets ? (
                    <View key={`s${i}`} style={styles.noteItem}>
                      <Text style={styles.noteTime}>🔓</Text>
                      <Text style={styles.noteLine}>{s}</Text>
                    </View>
                  ) : (
                    <View key={`s${i}`} style={styles.noteItem}>
                      <Text style={styles.noteTime}>🔒</Text>
                      <Text style={styles.noteLocked}>••••••••••••</Text>
                    </View>
                  )
                )}
              </View>
            </ScrollView>
          ) : null}

          {app === 'calendar' ? (
            <ScrollView contentContainerStyle={styles.listBody}>
              <Card style={styles.calCard}>
                {calendar.length ? (
                  calendar.map((e, i) => {
                    const day = dayParts(e.at);
                    return (
                      <View key={i} style={styles.calRow}>
                        <Text style={styles.calDay} numberOfLines={1}>
                          {day.md} <Text style={styles.calWeekday}>{day.wd}</Text>
                        </Text>
                        <Text style={styles.calText} numberOfLines={1}>
                          {e.text}
                        </Text>
                        {e.timed ? <Text style={styles.time}>{planTimeLabel(e.at).replace(/^\S+\s/, '')}</Text> : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.empty}>{t('…')}</Text>
                )}
              </Card>
            </ScrollView>
          ) : null}

          {app === 'album' ? (
            <ScrollView contentContainerStyle={styles.albumBody}>
              {photos.length ? (
                photos.map((p) => <Polaroid key={p.id} uri={p.uri} caption={p.caption} width={SHOT_WIDTH} tiltKey={p.id} />)
              ) : (
                <Text style={styles.empty}>{t('…')}</Text>
              )}
            </ScrollView>
          ) : null}
        </View>
      )}
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // 桌面
    home: { flex: 1 },
    homeTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.screen, paddingTop: 8 },
    homeClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    homeOwner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.inline, marginRight: 36 },
    homeOwnerName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    clock: { fontFamily: Fonts.labelBold, fontSize: 64, lineHeight: 64, color: '#FFFFFF', textAlign: 'center', marginTop: 18 },
    clockDate: { fontSize: 13, color: withAlpha('#FFFFFF', 0.85), textAlign: 'center', marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Space.screen, marginTop: 36, rowGap: 22 },
    tileWrap: { width: '25%', alignItems: 'center' },
    tile: { width: TILE, height: TILE, borderRadius: Shape.radius, backgroundColor: Romance.card, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { fontSize: 12, fontWeight: '500', color: '#FFFFFF', marginTop: 6 },
    tileLabelLatin: { fontFamily: Fonts.label },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: { fontFamily: Fonts.labelBold, fontSize: 12, color: '#FFFFFF' },
    // 内页
    screen: { flex: 1, backgroundColor: Romance.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Space.screen,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    back: { flexDirection: 'row', alignItems: 'center', width: Space.topBarSlot, gap: 2 },
    backText: { fontSize: 14, fontWeight: '500', color: Romance.ink },
    title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: Romance.ink },
    titleLatin: { fontFamily: Fonts.labelBold, fontWeight: '400' },
    right: { width: Space.topBarSlot, alignItems: 'flex-end' },
    listBody: { padding: Space.screen, gap: Space.inline, paddingBottom: 40 },
    convRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    convText: { flex: 1, minWidth: 0 },
    convHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.inline },
    convName: { fontSize: 15, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    convTag: { fontSize: 11, fontWeight: '500', color: Romance.sub },
    convPreview: { fontSize: 13, color: Romance.sub, marginTop: 2 },
    // 她在 TA 手机里的头像：paper 底 accent 首字（同 X 里「我的头像」）
    herAvatar: { width: 40, height: 40, borderRadius: Shape.radius, backgroundColor: Romance.accentSoft, alignItems: 'center', justifyContent: 'center' },
    herAvatarText: { fontFamily: Fonts.initial, fontSize: 17, fontWeight: '600', color: Romance.accentStrong },
    initial: { borderRadius: Shape.radius, backgroundColor: Romance.line, alignItems: 'center', justifyContent: 'center' },
    initialText: { fontFamily: Fonts.initial, fontWeight: '600', color: Romance.ink },
    // 会话（TA 视角：TA 在右）
    threadBody: { padding: Space.screen, gap: 6, paddingBottom: 40 },
    bubbleRow: { maxWidth: '80%', gap: 2 },
    bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: { paddingVertical: Space.bubbleY, paddingHorizontal: Space.bubbleX, borderRadius: Shape.radius },
    bubbleMine: { backgroundColor: Romance.bubbleMe, borderBottomRightRadius: Shape.radiusTail },
    bubbleTheirs: { backgroundColor: Romance.bubbleHim, borderBottomLeftRadius: Shape.radiusTail },
    bubbleText: { fontSize: 14, lineHeight: 20, color: Romance.ink },
    bubbleTextMine: { color: '#FFFFFF' },
    bubbleTime: { fontFamily: Fonts.label, fontSize: 10, color: Romance.sub, marginHorizontal: 2 },
    // TA 的记事本：唯一的米色纸面（NOTE_PAPER），描边同卡片
    note: {
      backgroundColor: NOTE_PAPER.bg,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      padding: Space.cardX,
      gap: 10,
    },
    noteItem: { gap: 2 },
    noteTime: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    noteLine: { fontSize: 14, lineHeight: 21, color: NOTE_PAPER.ink },
    noteLocked: { fontSize: 13, color: Romance.faint, letterSpacing: 1 },
    empty: { fontSize: 13, color: Romance.faint, marginLeft: 4 },
    calCard: { gap: 8 },
    calRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    calDay: { fontFamily: Fonts.label, fontSize: 12, color: Romance.accent, width: 64 },
    calWeekday: { fontFamily: Fonts.sans },
    calText: { flex: 1, fontSize: 13, color: Romance.ink },
    time: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    albumBody: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inlineLoose, padding: Space.screen, paddingBottom: 40, justifyContent: 'center' },
  })
);
