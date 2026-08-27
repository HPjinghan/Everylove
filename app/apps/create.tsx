/**
 * 创造（D-025 大改版；D-043 更名并加描述解析）：
 * 描述导入：写/粘贴一大段人设（≤2000 字）→「自动解析」由当前引擎整理成表单字段
 *          （prompt 在 content/prompts.ts 的 CHARACTER_PARSE_SYSTEM），无 key/失败回落规则解析；解析后仍可手改。
 * 基础：名字 → 性别（男/女/非二元）→ 长相描述 → 背景故事 → 立绘生成
 * 高级（默认收起）：种族 / 生日 / 口癖 / 喜欢 / 讨厌 / 确定关系的节奏（聊几句后 TA 开口）/
 *                 恋爱中的类型（content/characters.ts 的 LOVE_STYLES）/ MBTI / 其他聊天设定 / 日常作息
 * 全部设定进对话与生图 prompt（content/prompts.ts 的 characterProfileBlock / pursuitLine）。
 * 审核最小拦截：挡真人明星与 IP 角色（红线 #1/#4，完整流程见 OPEN_QUESTIONS #7）——描述文本同样过拦截。
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { BLOCKED_NAME_PATTERN, LOVE_STYLES, loveStyleByLabel, RACES } from '@/content/characters';
import { CHARACTER_PARSE_SYSTEM } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { completeText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { ensurePortrait, generatePortraitFor, imageKeyReady } from '@/lib/imagegen';
import type { Character } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 描述导入的最大长度（D-043） */
const DESC_MAX = 2000;

/**
 * 规则解析（无 key / 引擎失败时的回落）：认「标签：内容」式的行，MBTI 直接正则；
 * 什么标签都没有时，整段进背景故事。
 */
function heuristicParse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (labels: string[]): string | undefined => {
    for (const l of labels) {
      const m = text.match(new RegExp(`${l}\\s*[:：]\\s*([^\\n；;]+)`));
      if (m) return m[1].trim();
    }
    return undefined;
  };
  const put = (k: string, v?: string) => {
    if (v) out[k] = v;
  };
  put('name', grab(['名字', '姓名']));
  put('look', grab(['外貌', '长相', '外形', '样貌']));
  put('race', grab(['种族']));
  put('birthday', grab(['生日']));
  put('catchphrase', grab(['口癖', '口头禅']));
  put('likes', grab(['喜欢', '喜好']));
  put('dislikes', grab(['讨厌', '厌恶']));
  put('mbti', text.match(/\b([IE][NS][TF][JP])\b/i)?.[1]?.toUpperCase());
  put('schedule', grab(['作息', '日常作息']));
  put('chatNotes', grab(['聊天设定', '说话方式', '语气']));
  const g = grab(['性别']);
  if (g) out.gender = /男/.test(g) ? 'male' : /女/.test(g) ? 'female' : 'nonbinary';
  put('story', grab(['背景故事', '背景', '故事', '经历']) ?? text.slice(0, 300));
  return out;
}

const PALETTES = [
  { color: '#E58AA5', colorSoft: '#FDEDF2' },
  { color: '#8AA5E5', colorSoft: '#EDF1FD' },
  { color: '#5FB39B', colorSoft: '#E9F7F2' },
  { color: '#C99ADF', colorSoft: '#F7EEFB' },
  { color: '#E5AE6E', colorSoft: '#FDF4E9' },
  { color: '#546080', colorSoft: '#EDEFF5' },
];

const GENDERS = [
  { key: 'male', label: '男生', pronoun: '他' },
  { key: 'female', label: '女生', pronoun: '她' },
  { key: 'nonbinary', label: '非二元', pronoun: 'TA' },
] as const;

/** 确定关系的节奏：聊几句后 TA 会开口要联系方式 */
const OFFER_PACES = [
  { turns: 2, label: '心动很快', hint: '第 2 句就想留下你' },
  { turns: 4, label: '标准', hint: '聊上几句自然开口' },
  { turns: 7, label: '慢热', hint: '要多聊一会儿才肯说' },
];

const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function CreateScreen() {
  const router = useRouter();

  // ── 描述导入（D-043） ──
  const [desc, setDesc] = useState('');
  const [parsing, setParsing] = useState(false);

  // ── 基础 ──
  const [name, setName] = useState('');
  const [gender, setGender] = useState<(typeof GENDERS)[number]['key']>('male');
  const [look, setLook] = useState('');
  const [story, setStory] = useState('');
  const [palette, setPalette] = useState(0);
  const [portraitUri, setPortraitUri] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);

  // ── 高级（默认收起） ──
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [race, setRace] = useState('人类');
  const [raceCustom, setRaceCustom] = useState('');
  const [birthday, setBirthday] = useState('');
  const [catchphrase, setCatchphrase] = useState('');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [offerTurns, setOfferTurns] = useState(4);
  const [loveStyle, setLoveStyle] = useState<string | undefined>();
  const [mbti, setMbti] = useState<string | undefined>();
  const [chatNotes, setChatNotes] = useState('');
  const [schedule, setSchedule] = useState('');

  const finalRace = race === '其他' ? raceCustom.trim() : race;
  const style = loveStyleByLabel(loveStyle);
  const allText = [desc, name, look, story, raceCustom, catchphrase, likes, dislikes, chatNotes, schedule]
    .join(' ')
    .trim();

  /** 解析结果落进表单（各字段裁到表单上限；解析后仍可手改）；返回填了几项 */
  const applyParsed = (p: Record<string, unknown>): number => {
    const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    let n = 0;
    let advanced = false;
    if (s(p.name)) { setName(s(p.name).slice(0, 12)); n++; }
    const g = s(p.gender);
    if (g === 'male' || g === 'female' || g === 'nonbinary') { setGender(g); n++; }
    if (s(p.look)) { setLook(s(p.look).slice(0, 60)); n++; }
    if (s(p.story)) { setStory(s(p.story).slice(0, 300)); n++; }
    const r = s(p.race).slice(0, 10);
    if (r && r !== '人类') {
      if (RACES.includes(r)) setRace(r);
      else { setRace('其他'); setRaceCustom(r); }
      advanced = true; n++;
    }
    const bd = s(p.birthday).replace(/[月./]/g, '-').replace(/日/g, '');
    if (/^\d{1,2}-\d{1,2}$/.test(bd)) { setBirthday(bd); advanced = true; n++; }
    if (s(p.catchphrase)) { setCatchphrase(s(p.catchphrase).slice(0, 20)); advanced = true; n++; }
    if (s(p.likes)) { setLikes(s(p.likes).slice(0, 40)); advanced = true; n++; }
    if (s(p.dislikes)) { setDislikes(s(p.dislikes).slice(0, 40)); advanced = true; n++; }
    const ls = s(p.loveStyle);
    if (ls && LOVE_STYLES.some((l) => l.label === ls)) { setLoveStyle(ls); advanced = true; n++; }
    const mb = s(p.mbti).toUpperCase();
    if (MBTI_LIST.includes(mb)) { setMbti(mb); advanced = true; n++; }
    if (s(p.chatNotes)) { setChatNotes(s(p.chatNotes).slice(0, 120)); advanced = true; n++; }
    if (s(p.schedule)) { setSchedule(s(p.schedule).slice(0, 120)); advanced = true; n++; }
    if (advanced) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAdvancedOpen(true);
    }
    return n;
  };

  /** 自动解析：当前引擎整理成 JSON（prompt 见 content/prompts.ts）；无 key/失败回落规则解析 */
  const parseDesc = async () => {
    const text = desc.trim();
    if (!text || parsing) return;
    if (BLOCKED_NAME_PATTERN.test(text)) {
      Alert.alert('这个 TA 不能被创造出来', '描述里包含真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。');
      return;
    }
    setParsing(true);
    let parsed: Record<string, unknown> | null = null;
    try {
      const { engine, anthropicKey, qianfanKey } = useAppStore.getState();
      const raw = await completeText(CHARACTER_PARSE_SYSTEM, text, engine, {
        anthropic: anthropicKey,
        qianfan: qianfanKey,
      });
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      console.warn('[create] 引擎解析失败，回落规则解析：', e);
      parsed = null;
    }
    const n = applyParsed(parsed ?? heuristicParse(text));
    setParsing(false);
    Alert.alert(
      n ? '解析好了' : '没读出结构化的字段',
      n ? `填好了 ${n} 项。往下检查一下，每一项都还能改。` : '已把描述放进背景故事，其他项可以手动补。'
    );
  };

  /** 表单里的 TA（还没入库）：预览与立绘生成共用 */
  const draftCharacter = (id = 'draft'): Character | null => {
    if (!name.trim()) return null;
    const g = GENDERS.find((x) => x.key === gender)!;
    const identitySrc = story.trim() || look.trim();
    return {
      id,
      name: name.trim(),
      archetype: style?.archetype ?? 'gentle',
      loveTag: gender === 'nonbinary' ? 'nonbinary' : gender,
      gender,
      styleLabel: style?.label ?? '自创',
      identity: identitySrc ? identitySrc.slice(0, 18) : '你亲手捏出来的 TA',
      look: look.trim() || undefined,
      pronoun: g.pronoun,
      story: story.trim() || undefined,
      race: finalRace && finalRace !== '人类' ? finalRace : undefined,
      birthday: /^\d{1,2}-\d{1,2}$/.test(birthday.trim()) ? birthday.trim() : undefined,
      catchphrase: catchphrase.trim() || undefined,
      likes: likes.trim() || undefined,
      dislikes: dislikes.trim() || undefined,
      loveStyle: style?.label,
      mbti,
      chatNotes: chatNotes.trim() || undefined,
      schedule: schedule.trim() || undefined,
      offerAfterTurns: offerTurns,
      hook: style ? style.desc.split('；')[0] : 'TA 在等一个点开 TA 的人。',
      intro: '……你捏出来的 TA，正在看你。',
      tags: ['自创', ...(style ? [style.label] : []), ...(finalRace && finalRace !== '人类' ? [finalRace] : [])].slice(0, 3),
      adoptedCount: 0,
      ...PALETTES[palette],
      custom: true,
    };
  };

  const guard = (): boolean => {
    if (BLOCKED_NAME_PATTERN.test(allText)) {
      Alert.alert('这个 TA 不能被创造出来', '不能创造真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。');
      return false;
    }
    return true;
  };

  const genPortrait = async () => {
    const draft = draftCharacter();
    if (!draft) return;
    if (!imageKeyReady()) {
      Alert.alert('未配置千帆 key', '立绘与聊天共用千帆 key：在 .env.local 或「设置 → 开发者」里填好即可。');
      return;
    }
    if (!guard()) return;
    setGenerating(true);
    try {
      setPortraitUri(await generatePortraitFor(draft));
    } catch (e) {
      console.warn('[create] 立绘生成失败：', e);
      Alert.alert('立绘没画出来', '网络或生图服务出了点问题，可以再试一次，或先跳过（醒来后会在后台补画）。');
    } finally {
      setGenerating(false);
    }
  };

  const submit = () => {
    if (!name.trim()) return;
    if (!guard()) return;
    const id = uid('c');
    const character = draftCharacter(id);
    if (!character) return;
    useAppStore.getState().addCustomCharacter(character);
    if (portraitUri) useAppStore.getState().setPortrait(id, portraitUri);
    else if (imageKeyReady()) void ensurePortrait(id);
    // 重置表单
    setDesc(''); setName(''); setLook(''); setStory(''); setPortraitUri(undefined);
    setRace('人类'); setRaceCustom(''); setBirthday(''); setCatchphrase('');
    setLikes(''); setDislikes(''); setOfferTurns(4); setLoveStyle(undefined);
    setMbti(undefined); setChatNotes(''); setSchedule(''); setAdvancedOpen(false);
    Alert.alert('TA 醒过来了', '去「交友」里滑到 TA。', [
      { text: '去交友看看', onPress: () => router.push('/apps/dating') },
    ]);
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  return (
    <AppScreen title="创造">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>创造一个只属于你的 TA</Text>

          {/* ───────── 描述导入（D-043） ───────── */}
          <Text style={styles.step}>用一段话描述 TA（可选）</Text>
          <Text style={styles.stepHint}>
            写下或粘贴一段人设——小说片段、角色卡、脑子里的画面都行，最多 {DESC_MAX} 字。
            点「自动解析」帮你填好下面的表单，每一项都还能改。
          </Text>
          <TextInput
            style={[styles.input, styles.inputDesc]}
            value={desc}
            onChangeText={setDesc}
            placeholder="银灰色头发的年轻外科医生，毒舌但心软。父母常年在国外，一个人住在老城区……"
            placeholderTextColor={Romance.faint}
            multiline
            maxLength={DESC_MAX}
          />
          <View style={styles.descFoot}>
            <Text style={styles.descCount}>
              {desc.length}/{DESC_MAX}
            </Text>
            <Pressable
              style={[styles.parseBtn, (!desc.trim() || parsing) && styles.btnDisabled]}
              disabled={!desc.trim() || parsing}
              onPress={parseDesc}>
              {parsing ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.parseBtnText}>解析中…</Text>
                </View>
              ) : (
                <Text style={styles.parseBtnText}>自动解析</Text>
              )}
            </Pressable>
          </View>

          {/* ───────── 基础 ───────── */}
          <Text style={styles.step}>① TA 叫什么</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="给 TA 一个名字"
            placeholderTextColor={Romance.faint}
            maxLength={12}
          />

          <Text style={styles.step}>② TA 的性别</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Chip key={g.key} label={g.label} active={gender === g.key} onPress={() => setGender(g.key)} />
            ))}
          </View>

          <Text style={styles.step}>③ TA 长什么样</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={look}
            onChangeText={setLook}
            placeholder="银灰色头发，眼下有一颗泪痣，笑起来很凶……"
            placeholderTextColor={Romance.faint}
            multiline
            maxLength={60}
          />
          <View style={styles.paletteRow}>
            {PALETTES.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => setPalette(i)}
                style={[styles.swatch, { backgroundColor: p.color }, palette === i && styles.swatchActive]}
              />
            ))}
          </View>

          <Text style={styles.step}>④ TA 的背景故事</Text>
          <TextInput
            style={[styles.input, styles.inputStory]}
            value={story}
            onChangeText={setStory}
            placeholder="TA 是谁、从哪里来、身上背着什么故事……"
            placeholderTextColor={Romance.faint}
            multiline
            maxLength={300}
          />

          <Text style={styles.step}>⑤ TA 的立绘（可选，约 1 分钟）</Text>
          <Text style={styles.stepHint}>
            按 ③ 的描述画一张半身像。之后你们相处的每一格画面都会以它为参考，长相与穿着保持一致。
          </Text>
          {portraitUri ? (
            <Image source={{ uri: portraitUri }} style={styles.portrait} contentFit="cover" />
          ) : null}
          <Pressable
            style={[styles.secondaryBtn, (!name.trim() || generating) && styles.btnDisabled]}
            disabled={!name.trim() || generating}
            onPress={genPortrait}>
            {generating ? (
              <View style={styles.btnRow}>
                <ActivityIndicator color={Romance.accent} />
                <Text style={styles.secondaryBtnText}>正在生成立绘……</Text>
              </View>
            ) : (
              <Text style={styles.secondaryBtnText}>
                {portraitUri ? '不像？重画一张' : imageKeyReady() ? '生成 TA 的立绘' : '生成 TA 的立绘（未配千帆 key）'}
              </Text>
            )}
          </Pressable>

          {/* ───────── 高级选项（收起） ───────── */}
          <Pressable style={styles.advToggle} onPress={toggleAdvanced}>
            <Text style={styles.advToggleText}>{advancedOpen ? '收起高级选项 ▴' : '高级选项 ▾'}</Text>
            <Text style={styles.advToggleHint}>种族 · 生日 · 口癖 · 恋爱类型 · MBTI · 作息…</Text>
          </Pressable>

          {advancedOpen ? (
            <View>
              <Text style={styles.step}>种族</Text>
              <View style={styles.chipRow}>
                {[...RACES, '其他'].map((r) => (
                  <Chip key={r} label={r} active={race === r} onPress={() => setRace(r)} />
                ))}
              </View>
              {race === '其他' ? (
                <TextInput
                  style={styles.input}
                  value={raceCustom}
                  onChangeText={setRaceCustom}
                  placeholder="自定义种族，如：半人马 / 図书馆精"
                  placeholderTextColor={Romance.faint}
                  maxLength={10}
                />
              ) : null}

              <Text style={styles.step}>TA 的生日</Text>
              <TextInput
                style={styles.input}
                value={birthday}
                onChangeText={setBirthday}
                placeholder="MM-DD，如 03-08（会出现在你们的日历上）"
                placeholderTextColor={Romance.faint}
                maxLength={5}
              />

              <Text style={styles.step}>口癖</Text>
              <TextInput
                style={styles.input}
                value={catchphrase}
                onChangeText={setCatchphrase}
                placeholder="TA 挂在嘴边的话，如「……真拿你没办法」"
                placeholderTextColor={Romance.faint}
                maxLength={20}
              />

              <Text style={styles.step}>喜欢</Text>
              <TextInput
                style={styles.input}
                value={likes}
                onChangeText={setLikes}
                placeholder="黑咖啡、下雨天、猫……"
                placeholderTextColor={Romance.faint}
                maxLength={40}
              />

              <Text style={styles.step}>讨厌</Text>
              <TextInput
                style={styles.input}
                value={dislikes}
                onChangeText={setDislikes}
                placeholder="香菜、迟到、被拍头……"
                placeholderTextColor={Romance.faint}
                maxLength={40}
              />

              <Text style={styles.step}>确定关系的节奏</Text>
              <Text style={styles.stepHint}>聊几句之后，TA 会开口想要你的联系方式。</Text>
              <View style={styles.chipRow}>
                {OFFER_PACES.map((p) => (
                  <Pressable
                    key={p.turns}
                    style={[styles.paceCard, offerTurns === p.turns && styles.paceCardActive]}
                    onPress={() => setOfferTurns(p.turns)}>
                    <Text style={[styles.paceLabel, offerTurns === p.turns && { color: '#fff' }]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.paceHint, offerTurns === p.turns && { color: '#FFE3EC' }]}>
                      {p.hint}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.step}>TA 在恋爱中的类型</Text>
              <View style={styles.chipRow}>
                {LOVE_STYLES.map((l) => (
                  <Chip
                    key={l.label}
                    label={l.label}
                    active={loveStyle === l.label}
                    onPress={() => setLoveStyle(loveStyle === l.label ? undefined : l.label)}
                  />
                ))}
              </View>
              {style ? <Text style={styles.styleDesc}>{style.desc}</Text> : null}

              <Text style={styles.step}>MBTI</Text>
              <View style={styles.chipRow}>
                {MBTI_LIST.map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    active={mbti === m}
                    onPress={() => setMbti(mbti === m ? undefined : m)}
                  />
                ))}
              </View>

              <Text style={styles.step}>其他关于聊天的设定</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={chatNotes}
                onChangeText={setChatNotes}
                placeholder="如：会用一点方言；不主动发语音；叫我「小朋友」……"
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={120}
              />

              <Text style={styles.step}>日常作息</Text>
              <Text style={styles.stepHint}>TA 的一天怎么过——决定 TA 什么时候忙、什么时候来找你。</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={schedule}
                onChangeText={setSchedule}
                placeholder="早八晚六上班，周三晚上健身，习惯凌晨一点睡……"
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={120}
              />
            </View>
          ) : null}

          {/* 预览 + 醒来 */}
          {name.trim() ? (
            <View style={styles.previewCard}>
              <CharAvatar name={name.trim()} color={PALETTES[palette].color} size={44} uri={portraitUri} />
              <View style={styles.previewText}>
                <Text style={styles.previewName}>{name.trim()}</Text>
                <Text style={styles.previewHook} numberOfLines={1}>
                  {[GENDERS.find((g) => g.key === gender)?.label, style?.label, finalRace !== '人类' ? finalRace : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, !name.trim() && styles.btnDisabled]}
            disabled={!name.trim()}
            onPress={submit}>
            <Text style={styles.primaryBtnText}>让 TA 醒来</Text>
          </Pressable>
          <Text style={styles.footnote}>不能捏真人与 IP 角色 · 发布即默认同意创作规范</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    subtitle: { fontSize: 13, color: Romance.sub, marginTop: 8 },
    step: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 22, marginBottom: 10 },
    stepHint: { fontSize: 12, color: Romance.sub, marginTop: -6, marginBottom: 10, lineHeight: 18 },
    input: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: Romance.ink,
    },
    inputMultiline: { minHeight: 68, textAlignVertical: 'top' },
    inputStory: { minHeight: 100, textAlignVertical: 'top' },
    inputDesc: { minHeight: 130, textAlignVertical: 'top' },
    descFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    descCount: { fontSize: 11, color: Romance.faint },
    parseBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    parseBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipActive: { backgroundColor: Romance.accentSoft, borderColor: Romance.accent },
    chipText: { fontSize: 13, color: Romance.sub, fontWeight: '500' },
    chipTextActive: { color: Romance.accent, fontWeight: '700' },
    paletteRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchActive: { borderWidth: 3, borderColor: Romance.ink },
    paceCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    paceCardActive: { backgroundColor: Romance.accent },
    paceLabel: { fontSize: 14, fontWeight: '700', color: Romance.ink },
    paceHint: { fontSize: 10, color: Romance.faint, marginTop: 3 },
    styleDesc: {
      fontSize: 12,
      color: Romance.accent,
      backgroundColor: Romance.accentSoft,
      borderRadius: 14,
      padding: 12,
      marginTop: 10,
      lineHeight: 18,
    },
    advToggle: {
      marginTop: 26,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 14,
      alignItems: 'center',
    },
    advToggleText: { fontSize: 14, fontWeight: '700', color: Romance.accent },
    advToggleHint: { fontSize: 11, color: Romance.faint, marginTop: 3 },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 14,
      marginTop: 24,
    },
    previewText: { flex: 1 },
    previewName: { fontSize: 16, fontWeight: '700', color: Romance.ink },
    previewHook: { fontSize: 12, color: Romance.sub, marginTop: 3 },
    primaryBtn: {
      marginTop: 14,
      backgroundColor: Romance.accent,
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
      marginTop: 10,
      borderRadius: 20,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: Romance.accent,
    },
    secondaryBtnText: { color: Romance.accent, fontSize: 15, fontWeight: '600' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    portrait: { width: 180, height: 180, borderRadius: 26, alignSelf: 'center', marginBottom: 4 },
    footnote: { textAlign: 'center', fontSize: 11, color: Romance.faint, marginTop: 12 },
  })
);
