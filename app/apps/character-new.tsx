/**
 * 分步捏人（D-260）：新建一个 TA 不再是填一张表，而是一步一步把 TA 捏出来。
 * - 起点二选一：「我心里已经有 TA 了」（贴一段描述 → 解析 → 档案卡，每项点一下去改）/「从零开始」。
 * - ① TA 是谁：名字 / 性别 / 背景故事 + 恋爱类型卡片（必选）。
 * - ② TA 长什么样：立绘（上传或生成，必须有）/ 画风 / 长相 / 主题色。
 * - ③ 听听 TA：这个恋爱类型的那句话，用 TA 的声音念出来；「换个声音」在同性别的声线里轮着换、轮完从头再来。
 *   念的是提前录好放在云端的（lib/voice-samples.ts），不现场合成。
 * - 醒来之前：私密 / 公开、更多设定（收着，想填再展开）、成年声明 → 让 TA 醒来。
 * - 醒来：TA 的台词在这时写一次（文字调用，平台出）；全屏仪式——立绘像拍立得一样显影，TA 的第一句话浮出来。
 * 捏了一半自动存草稿（store.createDraft），退出再进来接着捏；右上角「重来」丢掉草稿。
 * 编辑已创建的 TA 在 app/apps/character-edit.tsx（页签式）。
 */

import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showAlert } from '@/components/action-sheet';
import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import {
  alertBlocked,
  DetailFields,
  IdentityFields,
  LookFields,
  LoveStylePicker,
  publishIfPublic,
  VisibilityField,
  type Patch,
} from '@/components/character-fields';
import { DevelopingFilm } from '@/components/developing';
import { Input } from '@/components/input';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemePaper } from '@/components/wallpaper';
import { Fonts, Romance, themed } from '@/constants/theme';
import { Shape, Space, Type } from '@/constants/design';
import { loveStyleByLabel, scriptFor } from '@/content/characters';
import { authConfigured, signedInSession } from '@/lib/auth';
import {
  applyParsed,
  BLANK_FORM,
  blocked,
  characterFromForm,
  DESC_MAX,
  GENDERS,
  heuristicParse,
  type CharacterForm,
  type CreateDraft,
  type CreateStep,
} from '@/lib/character-form';
import { generateCharacterLines } from '@/lib/character-lines';
import { parseCharacterDescription } from '@/lib/character-parse';
import { uid } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { getLang, t } from '@/lib/i18n';
import { audioSession, claimVoicePlayback } from '@/lib/audio-session';
import { defaultVoiceId, voicesFor } from '@/lib/speech';
import { sampleClip } from '@/lib/voice-samples';
import { showToast } from '@/components/toast';
import { useAppStore } from '@/store/app-store';

/** 主线的四步（档案卡 / 贴描述不算进度） */
const MAIN_STEPS: CreateStep[] = ['who', 'look', 'voice', 'wake'];

/** 每一步的标题（显示时 t()） */
const STEP_TITLES: { step: CreateStep; title: string }[] = [
  { step: 'import', title: '我心里已经有 TA 了' },
  { step: 'review', title: 'TA 的档案' },
  { step: 'who', title: 'TA 是谁' },
  { step: 'look', title: 'TA 长什么样' },
  { step: 'voice', title: '听听 TA' },
  { step: 'wake', title: '醒来之前' },
];

/** 档案卡上一行一项：解析填上的字段 → 名字 + 去哪一步改 */
const FILLED_ROWS: { key: keyof CharacterForm; label: string; step: CreateStep }[] = [
  { key: 'name', label: '名字', step: 'who' },
  { key: 'gender', label: '性别', step: 'who' },
  { key: 'loveStyle', label: '恋爱类型', step: 'who' },
  { key: 'story', label: '背景故事', step: 'who' },
  { key: 'look', label: '长相', step: 'look' },
  { key: 'race', label: '种族', step: 'wake' },
  { key: 'raceCustom', label: '种族', step: 'wake' },
  { key: 'birthday', label: '生日', step: 'wake' },
  { key: 'catchphrase', label: '口癖', step: 'wake' },
  { key: 'likes', label: '喜欢', step: 'wake' },
  { key: 'dislikes', label: '讨厌', step: 'wake' },
  { key: 'mbti', label: 'MBTI', step: 'wake' },
  { key: 'initiative', label: '主动联系强度', step: 'wake' },
  { key: 'presetMemories', label: '预设共同记忆', step: 'wake' },
  { key: 'taboos', label: '禁忌 / 边界', step: 'wake' },
  { key: 'secrets', label: '隐藏设定 / 剧情钩子', step: 'wake' },
  { key: 'chatNotes', label: '其他关于聊天的设定', step: 'wake' },
  { key: 'schedule', label: '日常作息', step: 'wake' },
];

/** 草稿多久存一次（打字时不每个字都写盘） */
const SAVE_DEBOUNCE_MS = 400;
/** 醒来那下的冷却（D-121）：这段时间里再点不响应 */
const SUBMIT_COOLDOWN_MS = 1000;

const freshDraft = (): CreateDraft => ({ form: BLANK_FORM, step: 'start', desc: '', filled: [], at: 0 });

/** 档案卡上的值：性别 / 恋爱类型 / 主动强度这类存的是键，显示成字 */
function filledValue(f: CharacterForm, key: keyof CharacterForm): string {
  if (key === 'gender') return t(GENDERS.find((g) => g.key === f.gender)?.label ?? '');
  if (key === 'loveStyle') return f.loveStyle ? t(f.loveStyle) : '';
  if (key === 'initiative') return t(f.initiative === 'high' ? '高' : f.initiative === 'low' ? '低' : '中');
  if (key === 'race') return f.race === '其他' ? '' : t(f.race);
  const v = f[key];
  return typeof v === 'string' ? v : '';
}

/** 上一步：主线往回退一步；从头捏的 ① 回起点，从描述来的 ① 回档案卡 */
function prevStep(d: CreateDraft): CreateStep | null {
  switch (d.step) {
    case 'import':
      return 'start';
    case 'review':
      return 'import';
    case 'who':
      return d.desc.trim() ? 'review' : 'start';
    case 'look':
      return 'who';
    case 'voice':
      return 'look';
    case 'wake':
      return 'voice';
    default:
      return null;
  }
}

interface Woke {
  id: string;
  name: string;
  portraitUri?: string;
  /** TA 的第一句话（台词写好了才有） */
  line?: string;
  /** 第一次把人加进通讯录、又没登录：仪式之后去登录（D-062） */
  needsLogin: boolean;
}

export default function CharacterNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<CreateDraft>(() => useAppStore.getState().createDraft ?? freshDraft());
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [woke, setWoke] = useState<Woke | null>(null);
  const submitLock = useRef(0);

  // 草稿（D-260）：选了从哪开始之后就自动存；醒来后清掉
  useEffect(() => {
    if (d.step === 'start' || woke) return;
    const h = setTimeout(() => useAppStore.getState().setCreateDraft({ ...d, at: Date.now() }), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [d, woke]);

  const form = d.form;
  const patch: Patch = (p) => setD((x) => ({ ...x, form: { ...x.form, ...p } }));
  const go = (step: CreateStep) => {
    setD((x) => ({ ...x, step }));
    if (step === 'wake') setMoreOpen(false);
  };

  const restart = () =>
    showAlert(t('丢掉这个草稿？'), undefined, [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('丢掉'),
        style: 'destructive',
        onPress: () => {
          useAppStore.getState().setCreateDraft(null);
          setD(freshDraft());
        },
      },
    ]);

  /** 读一读：引擎整理成字段（content/prompts/create.ts）；失败回落规则解析（D-043 / D-069） */
  const read = async () => {
    const text = d.desc.trim();
    if (!text || parsing) return;
    if (blocked(BLANK_FORM, text)) {
      alertBlocked();
      return;
    }
    setParsing(true);
    let parsed: Record<string, unknown>;
    try {
      parsed = await parseCharacterDescription(text);
    } catch (e) {
      console.warn('[create] 引擎解析失败，回落规则解析：', e);
      parsed = heuristicParse(text);
    }
    setParsing(false);
    const { form: next, filled } = applyParsed(BLANK_FORM, parsed);
    setD((x) => ({ ...x, form: next, filled, step: 'review' }));
  };

  /** 让 TA 醒来：台词写一次（平台出）→ 入库 → 仪式；台词写不成先用通用版 */
  const wake = async () => {
    const now = Date.now();
    if (submitLock.current === -1 || now - submitLock.current < SUBMIT_COOLDOWN_MS) return;
    if (blocked(form, d.desc)) {
      alertBlocked();
      return;
    }
    const id = uid('c');
    const draft = characterFromForm(form, { id, lines: null });
    if (!draft || !form.portraitUri) return;
    submitLock.current = -1;
    setPublishing(true);
    haptic.success();
    setWoke({ id, name: draft.name, portraitUri: form.portraitUri, needsLogin: false });
    try {
      const written = await generateCharacterLines(draft);
      if (!written) showToast(t('台词先用了通用版'));
      let character = written ? { ...draft, lines: written } : draft;
      // 强制登录判定（D-062）：这是不是第一次把人添加进通讯录
      const s = useAppStore.getState();
      const hadContacts = s.bonds.length > 0 || s.customCharacters.some((c) => !c.shared);
      character = await publishIfPublic(character);
      s.addCustomCharacter(character);
      s.setPortrait(id, form.portraitUri);
      // 自创角色直入通讯录的「认识中」（D-052）：好奇满 100 才成为朋友
      s.ensureSquareChat(id);
      s.setCreateDraft(null);
      const needsLogin = !hadContacts && authConfigured() && !(await signedInSession());
      setWoke({ id, name: character.name, portraitUri: form.portraitUri, line: scriptFor(character).opening[0], needsLogin });
    } finally {
      submitLock.current = Date.now();
      setPublishing(false);
    }
  };

  if (woke) {
    return (
      <WakeCeremony
        woke={woke}
        onTalk={() =>
          woke.needsLogin
            ? router.replace({ pathname: '/auth', params: { force: '1' } })
            : router.replace({ pathname: '/chat/[characterId]', params: { characterId: woke.id } })
        }
        onAnother={() => {
          if (woke.needsLogin) {
            router.replace({ pathname: '/auth', params: { force: '1' } });
            return;
          }
          setWoke(null);
          setD(freshDraft());
        }}
      />
    );
  }

  const style = loveStyleByLabel(form.loveStyle);
  // 底部主按钮：每一步的字、能不能点、点了做什么
  const nextLabel: Partial<Record<CreateStep, string>> = {
    import: parsing ? t('读中…') : t('读一读'),
    review: t('接着捏'),
    who: t('下一步'),
    look: t('下一步'),
    voice: t('下一步'),
    wake: publishing ? t('…') : t('让 TA 醒来'),
  };
  const nextEnabled =
    d.step === 'import'
      ? !!d.desc.trim() && !parsing
      : d.step === 'who'
        ? !!form.name.trim() && !!form.loveStyle
        : d.step === 'look' || d.step === 'wake'
          ? !!form.portraitUri && !publishing
          : true;
  const onNext = () => {
    if (d.step === 'import') void read();
    else if (d.step === 'review') go('who');
    else if (d.step === 'who') go('look');
    else if (d.step === 'look') go('voice');
    else if (d.step === 'voice') go('wake');
    else if (d.step === 'wake') void wake();
  };
  const back = prevStep(d);
  const progress = MAIN_STEPS.indexOf(d.step);
  const title = STEP_TITLES.find((x) => x.step === d.step)?.title;

  return (
    <AppScreen title={t('创造')} right={d.step !== 'start' ? <HeaderAction label={t('重来')} onPress={restart} /> : undefined}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 换一步整块重挂载，回到最上面 */}
        <ScrollView key={d.step} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {progress >= 0 ? (
            <View style={styles.dots}>
              {MAIN_STEPS.map((s, i) => (
                <View key={s} style={[styles.dot, i <= progress && styles.dotOn]} />
              ))}
            </View>
          ) : null}
          {title ? <Text style={styles.stepTitle}>{t(title)}</Text> : null}

          {d.step === 'start' ? (
            <View style={styles.startList}>
              <StartCard icon="book" title={t('我心里已经有 TA 了')} onPress={() => go('import')} />
              <StartCard icon="magicHat" title={t('从零开始')} onPress={() => go('who')} />
            </View>
          ) : null}

          {d.step === 'import' ? (
            <View style={styles.importBox}>
              <Input
                value={d.desc}
                onChangeText={(desc) => setD((x) => ({ ...x, desc }))}
                placeholder={t('银灰色头发的年轻外科医生，毒舌但心软。父母常年在国外，一个人住在老城区……')}
                multiline
                maxLength={DESC_MAX}
                style={styles.descInput}
              />
              <Text style={styles.count}>
                {d.desc.length}/{DESC_MAX}
              </Text>
            </View>
          ) : null}

          {d.step === 'review' ? <ReviewCard form={form} filled={d.filled} onEdit={(s) => { go(s); if (s === 'wake') setMoreOpen(true); }} /> : null}

          {d.step === 'who' ? (
            <View>
              <IdentityFields form={form} patch={patch} />
              <LoveStylePicker value={form.loveStyle} onChange={(loveStyle) => patch({ loveStyle })} />
            </View>
          ) : null}

          {d.step === 'look' ? <LookFields form={form} patch={patch} portraitSize={200} /> : null}

          {d.step === 'voice' ? <HearStep form={form} patch={patch} sample={style ? t(style.sample) : ''} /> : null}

          {d.step === 'wake' ? (
            <View>
              <Card style={styles.summary}>
                {form.portraitUri ? <Image source={{ uri: form.portraitUri }} style={styles.summaryPortrait} contentFit="cover" /> : null}
                <View style={styles.flex}>
                  <Text style={styles.summaryName}>{form.name}</Text>
                  {style ? <Text style={styles.summarySub}>{t(style.label)}</Text> : null}
                </View>
              </Card>
              <VisibilityField form={form} patch={patch} />
              <Button
                label={moreOpen ? t('收起') : t('更多设定')}
                variant="secondary"
                size="md"
                style={styles.moreBtn}
                onPress={() => setMoreOpen((v) => !v)}
              />
              {moreOpen ? <DetailFields form={form} patch={patch} /> : null}
              <Text style={styles.footnote}>{t('发布即确认 TA 是成年人。')}</Text>
              <Text style={styles.footnote}>{t('不能创造真人与 IP 角色 · 发布即默认同意创作规范')}</Text>
            </View>
          ) : null}
        </ScrollView>

        {nextLabel[d.step] ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Space.screen) }]}>
            {back ? <Button label={t('上一步')} variant="paper" style={styles.backBtn} onPress={() => go(back)} /> : null}
            <Button label={nextLabel[d.step]!} style={styles.flex} disabled={!nextEnabled} onPress={onNext} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function StartCard({ icon, title, onPress }: { icon: 'book' | 'magicHat'; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.startCard}>
        <View style={styles.startIcon}>
          <MingCute name={icon} size={24} color={Romance.accent} />
        </View>
        <Text style={styles.startTitle}>{title}</Text>
        <IconSymbol name="chevron.right" size={14} color={Romance.faint} />
      </Card>
    </Pressable>
  );
}

/** 档案卡（D-260）：解析出来的每一项都看得见，点一下去那一步改 */
function ReviewCard({ form, filled, onEdit }: { form: CharacterForm; filled: (keyof CharacterForm)[]; onEdit: (step: CreateStep) => void }) {
  const rows = FILLED_ROWS.filter((r) => filled.includes(r.key) && filledValue(form, r.key));
  if (!rows.length) return <Text style={styles.reviewEmpty}>{t('没读出来。')}</Text>;
  return (
    <Card padded={false}>
      {rows.map((r, i) => (
        <View key={r.key}>
          {i > 0 ? <Divider soft /> : null}
          <Pressable style={styles.reviewRow} onPress={() => onEdit(r.step)}>
            <Text style={styles.reviewLabel}>{t(r.label)}</Text>
            <Text style={styles.reviewValue} numberOfLines={3}>
              {filledValue(form, r.key)}
            </Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

/**
 * ③ 听听 TA（D-260）：恋爱类型那句话，用 TA 的声音念。第一把是跟着恋爱类型的默认声，
 * 「换个声音」在同性别的声线里轮着换、换了就念，轮完从头再来；念的是云端提前录好的（lib/voice-samples）。
 */
function HearStep({ form, patch, sample }: { form: CharacterForm; patch: Patch; sample: string }) {
  const lang = getLang();
  const player = useAudioPlayer(null);
  const [busy, setBusy] = useState(false);
  const pronoun = GENDERS.find((g) => g.key === form.gender)!.pronoun;
  const all = voicesFor(lang);
  const fallbackId = defaultVoiceId({ id: '', gender: form.gender, loveStyle: form.loveStyle }, lang);
  const pool = all.filter((v) => form.gender === 'nonbinary' || v.gender === form.gender || v.gender === 'nonbinary');
  // 轮换的顺序：默认那把（= 不选）在前，其余按池子顺序
  const cycle: (string | undefined)[] = [undefined, ...pool.map((v) => v.id).filter((id) => id !== fallbackId)];
  const currentId = form.voiceId ?? fallbackId;
  const current = all.find((v) => v.id === currentId);

  const play = async (voiceId: string | undefined) => {
    const id = voiceId ?? fallbackId;
    if (!id || !sample || busy) return;
    setBusy(true);
    const uri = await sampleClip(sample, id, lang, pronoun);
    setBusy(false);
    if (!uri) {
      showToast(t('试听没成功'));
      return;
    }
    await audioSession.playback();
    claimVoicePlayback(() => player.pause());
    player.replace({ uri });
    player.seekTo(0);
    player.play();
  };

  const nextVoice = () => {
    const i = Math.max(0, cycle.indexOf(form.voiceId));
    const id = cycle[(i + 1) % cycle.length];
    patch({ voiceId: id });
    haptic.tick();
    void play(id);
  };

  return (
    <View style={styles.hear}>
      {form.portraitUri ? <Image source={{ uri: form.portraitUri }} style={styles.hearPortrait} contentFit="cover" /> : null}
      <Text style={styles.hearName}>{form.name}</Text>
      {sample ? (
        <Pressable style={styles.bubble} onPress={() => void play(form.voiceId)} accessibilityRole="button">
          <Text style={styles.bubbleText}>{sample}</Text>
          {current ? <IconSymbol name="play.fill" size={12} color={busy ? Romance.faint : Romance.sub} /> : null}
        </Pressable>
      ) : null}
      {current && cycle.length > 1 ? (
        <View style={styles.voiceRow}>
          <Text style={styles.voiceName}>{t(current.vibe)}</Text>
          <Button label={t('换个声音')} variant="outline" size="sm" disabled={busy} onPress={nextVoice} />
        </View>
      ) : null}
    </View>
  );
}

/** 醒来（D-260）：铺主题自带的纸，立绘像拍立得一样显影，TA 的第一句话浮出来 */
function WakeCeremony({ woke, onTalk, onAnother }: { woke: Woke; onTalk: () => void; onAnother: () => void }) {
  const insets = useSafeAreaInsets();
  const film = useSharedValue(1);
  const lineIn = useSharedValue(0);
  useEffect(() => {
    film.set(withTiming(0, { duration: 2400 }));
  }, [film]);
  useEffect(() => {
    if (woke.line) lineIn.set(withDelay(600, withTiming(1, { duration: 700 })));
  }, [woke.line, lineIn]);
  const filmStyle = useAnimatedStyle(() => ({ opacity: film.get() }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: lineIn.get(), transform: [{ translateY: (1 - lineIn.get()) * 8 }] }));
  return (
    <View style={[styles.ceremony, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, Space.screen) }]}>
      <ThemePaper />
      <View style={styles.ceremonyBody}>
        <View style={styles.polaroid}>
          <View style={styles.polaroidPhoto}>
            {woke.portraitUri ? <Image source={{ uri: woke.portraitUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, filmStyle]}>
              <DevelopingFilm width={POLAROID_PHOTO} height={(POLAROID_PHOTO * 4) / 3} />
            </Animated.View>
          </View>
          <Text style={styles.polaroidName}>{woke.name}</Text>
        </View>
        <Animated.View style={[styles.firstLine, lineStyle]}>
          <Text style={styles.bubbleText}>{woke.line ?? ' '}</Text>
        </Animated.View>
      </View>
      <View style={styles.ceremonyActions}>
        <Button label={t('去和 TA 说话')} disabled={!woke.line} onPress={onTalk} />
        <Pressable onPress={onAnother} disabled={!woke.line} hitSlop={8} style={styles.anotherBtn}>
          <Text style={styles.anotherText}>{t('再捏一个')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const POLAROID_PHOTO = 200;

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: 18, paddingBottom: 32 },
    dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: Space.inlineLoose },
    dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: Romance.line },
    dotOn: { backgroundColor: Romance.accent },
    stepTitle: { fontSize: Type.scale.xl.size, fontWeight: '700', color: Romance.ink, marginTop: Space.screen, marginBottom: 4 },
    startList: { gap: Space.inlineLoose, marginTop: Space.screen },
    startCard: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, paddingVertical: 22 },
    startIcon: { width: 44, height: 44, borderRadius: Shape.radius, backgroundColor: Romance.accentSoft, alignItems: 'center', justifyContent: 'center' },
    startTitle: { flex: 1, fontSize: Type.scale.md.size, fontWeight: '600', color: Romance.ink },
    importBox: { marginTop: Space.inlineLoose },
    descInput: { minHeight: 220 },
    count: { fontFamily: Fonts.label, fontSize: Type.scale.timestamp.size, color: Romance.sub, textAlign: 'right', marginTop: 4 },
    reviewEmpty: { fontSize: Type.scale.sub.size, color: Romance.sub, marginTop: Space.inlineLoose },
    reviewRow: { flexDirection: 'row', gap: Space.inlineLoose, paddingVertical: 12, paddingHorizontal: Space.cardX },
    reviewLabel: { width: 84, fontSize: Type.scale.label.size, color: Romance.sub },
    reviewValue: { flex: 1, fontSize: Type.scale.label.size, color: Romance.ink },
    hear: { alignItems: 'center', paddingTop: Space.screen, gap: Space.inlineLoose },
    hearPortrait: { width: 120, height: 160, borderRadius: Shape.radius },
    hearName: { fontSize: Type.scale.md.size, fontWeight: '600', color: Romance.ink },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inline,
      backgroundColor: Romance.bubbleHim,
      borderRadius: Shape.radiusBubble,
      paddingVertical: 10,
      paddingHorizontal: 14,
      maxWidth: '86%',
    },
    bubbleText: { fontSize: Type.scale.body.size, color: Romance.ink, lineHeight: 21 },
    voiceRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, marginTop: Space.inline },
    voiceName: { fontSize: Type.scale.sub.size, color: Romance.sub },
    summary: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, marginTop: Space.inlineLoose },
    summaryPortrait: { width: 48, height: 64, borderRadius: Shape.radiusInner },
    summaryName: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    summarySub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
    moreBtn: { marginTop: Space.cardX },
    footnote: { fontSize: Type.scale.timestamp.size, color: Romance.sub, textAlign: 'center', marginTop: Space.inlineLoose },
    footer: {
      flexDirection: 'row',
      gap: Space.inlineLoose,
      paddingHorizontal: 18,
      paddingTop: Space.inline,
      borderTopWidth: 1,
      borderTopColor: Romance.line,
      backgroundColor: Romance.bg,
    },
    backBtn: { paddingHorizontal: 22 },
    ceremony: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
    ceremonyBody: { alignItems: 'center', gap: 22 },
    polaroid: { backgroundColor: Romance.card, padding: 10, paddingBottom: 14, borderRadius: Shape.radiusInner, transform: [{ rotate: '-2deg' }] },
    polaroidPhoto: { width: POLAROID_PHOTO, height: (POLAROID_PHOTO * 4) / 3, overflow: 'hidden', backgroundColor: Romance.line },
    polaroidName: { fontFamily: Fonts.initial, fontSize: Type.scale.md.size, color: Romance.ink, textAlign: 'center', marginTop: 10 },
    firstLine: { backgroundColor: Romance.bubbleHim, borderRadius: Shape.radiusBubble, paddingVertical: 10, paddingHorizontal: 14, maxWidth: '80%' },
    ceremonyActions: { paddingHorizontal: 32, gap: Space.inlineLoose, alignItems: 'stretch' },
    anotherBtn: { alignSelf: 'center', paddingVertical: 6 },
    anotherText: { fontSize: Type.scale.sub.size, color: Romance.sub },
  })
);
