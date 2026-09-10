/**
 * 创造（D-025 大改版；D-043 更名并加描述解析；D-100 纸面）：
 * 描述导入：写/粘贴一大段人设（≤2000 字）→「自动解析」由当前引擎整理成表单字段
 *          （prompt 在 content/prompts/create.ts 的 CHARACTER_PARSE_SYSTEM），无 key/失败回落规则解析；解析后仍可手改。
 * 基础：名字 → 性别（男/女/非二元）→ 长相描述 → 背景故事 → 立绘生成
 * 高级（默认收起）：种族 / 生日 / 口癖 / 喜欢 / 讨厌 / 确定关系的节奏（聊几句后 TA 开口）/
 *                 恋爱中的类型（content/characters.ts 的 LOVE_STYLES）/ MBTI / 其他聊天设定 / 日常作息
 * 全部设定进对话与生图 prompt（content/prompts/shared.ts 的 characterProfileBlock / pursuitLine）。
 * 审核最小拦截：挡真人明星与 IP 角色（红线 #1/#4，完整流程见 OPEN_QUESTIONS #7）——描述文本同样过拦截。
 * 界面：字段一律 Field + Input、选项一律 Chip、按钮一律 Button、卡片一律 Card；顶栏右「我创建的」进列表页。
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { REAL_WORLD_ID } from '@/content/worlds';
import { canPublishCharacter, selectableFrom, worldSnapshotFor } from '@/lib/worlds';
import { showToast } from '@/components/toast';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { BLOCKED_NAME_PATTERN, LOVE_STYLES, loveStyleByLabel, RACES } from '@/content/characters';
import { characterParseSystem, DEFAULT_PORTRAIT_STYLE, PORTRAIT_STYLES } from '@/content/prompts';
import { authConfigured, signedInSession } from '@/lib/auth';
import { getLang, t } from '@/lib/i18n';
import { completeText, describeAiError } from '@/lib/engine';
import { uid } from '@/lib/format';
import { generateCharacterLines } from '@/lib/character-lines';
import { generatePortraitFor, imageKeyReady } from '@/lib/imagegen';
import { publishCharacter, unpublishCharacter } from '@/lib/pool';
import type { Character, CharacterLines } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 描述导入的最大长度（D-043） */
const DESC_MAX = 2000;

/** 主题色块选中外圈：ink 2.5、留 2（同设置页主题点） */
const SWATCH_RING = { width: 2.5, gap: 2 };

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
  put('taboos', grab(['禁忌', '边界', '雷点']));
  put('presetMemories', grab(['共同记忆', '共同的过去']));
  put('secrets', grab(['秘密', '隐藏设定', '剧情钩子']));
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

/** 确定关系的节奏（机制上=心动值步长；界面不暴露机制口径，D-045） */
const OFFER_PACES = [
  { turns: 2, label: '心动很快', hint: '一眼就沦陷' },
  { turns: 4, label: '标准', hint: '顺其自然' },
  { turns: 7, label: '慢热', hint: '需要时间发酵' },
];

/** 主动联系强度（D-045）：进亲密/外出 prompt */
const INITIATIVES = [
  { key: 'high', label: '高', hint: '常常先来找你' },
  { key: 'mid', label: '中', hint: '自然往来' },
  { key: 'low', label: '低', hint: '多半等你先开口' },
] as const;

/** 生日下拉用：某月的天数（2 月给到 29） */
const daysInMonth = (m: number) => (m === 2 ? 29 : [4, 6, 9, 11].includes(m) ? 30 : 31);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const EMPTY_LINES: CharacterLines = { opening: [], offer: [], arrival: [] };

type Gender = (typeof GENDERS)[number]['key'];
type ArtStyle = (typeof PORTRAIT_STYLES)[number]['id'];

/** 表单的一份初始值：新建 = 空白；编辑 = 从已创建的角色回填（D-050 / D-095） */
type FormInit = {
  editing: Character | null;
  name: string;
  gender: Gender;
  ageStatus: 'adult' | 'minor';
  visibility: 'private' | 'public';
  /** 所在的世界（D-110）：世界书收藏里选；undefined = 现实世界 */
  worldId: string | undefined;
  look: string;
  story: string;
  palette: number;
  portraitUri: string | undefined;
  artStyle: ArtStyle;
  advancedOpen: boolean;
  race: string;
  raceCustom: string;
  birthMonth: number | null;
  birthDay: number | null;
  catchphrase: string;
  likes: string;
  dislikes: string;
  offerTurns: number;
  loveStyle: string | undefined;
  mbti: string | undefined;
  initiative: 'high' | 'mid' | 'low';
  presetMemories: string;
  taboos: string;
  secrets: string;
  chatNotes: string;
  schedule: string;
  lines: CharacterLines | null;
};

const BLANK_FORM: FormInit = {
  editing: null,
  name: '',
  gender: 'male',
  ageStatus: 'adult',
  visibility: 'private',
  worldId: undefined,
  look: '',
  story: '',
  palette: 0,
  portraitUri: undefined,
  artStyle: DEFAULT_PORTRAIT_STYLE,
  advancedOpen: false,
  race: '人类',
  raceCustom: '',
  birthMonth: null,
  birthDay: null,
  catchphrase: '',
  likes: '',
  dislikes: '',
  offerTurns: 4,
  loveStyle: undefined,
  mbti: undefined,
  initiative: 'mid',
  presetMemories: '',
  taboos: '',
  secrets: '',
  chatNotes: '',
  schedule: '',
  lines: null,
};

/** 编辑已创建的角色（D-050）：全部字段回填进表单（高级区直接展开） */
function formFor(c: Character): FormInit {
  const pi = PALETTES.findIndex((p) => p.color === c.color);
  const race = !c.race
    ? { race: '人类', raceCustom: '' }
    : RACES.includes(c.race)
      ? { race: c.race, raceCustom: '' }
      : { race: '其他', raceCustom: c.race };
  const [bm, bd] =
    c.birthday && /^\d{1,2}-\d{1,2}$/.test(c.birthday) ? c.birthday.split('-').map(Number) : [null, null];
  return {
    editing: c,
    name: c.name,
    gender: c.gender ?? (c.loveTag === 'female' ? 'female' : c.loveTag === 'nonbinary' ? 'nonbinary' : 'male'),
    ageStatus: 'adult', // 已发布的都确认过成年
    visibility: c.visibility ?? 'private',
    worldId: c.worldId,
    look: c.look ?? '',
    story: c.story ?? '',
    palette: pi >= 0 ? pi : 0,
    portraitUri: useAppStore.getState().portraits[c.id],
    artStyle: c.artStyle ?? DEFAULT_PORTRAIT_STYLE,
    advancedOpen: true,
    ...race,
    birthMonth: bm,
    birthDay: bd,
    catchphrase: c.catchphrase ?? '',
    likes: c.likes ?? '',
    dislikes: c.dislikes ?? '',
    offerTurns: c.offerAfterTurns ?? 4,
    loveStyle: c.loveStyle,
    mbti: c.mbti,
    initiative: c.initiative ?? 'mid',
    presetMemories: c.presetMemories ?? '',
    taboos: c.taboos ?? '',
    secrets: c.secrets ?? '',
    chatNotes: c.chatNotes ?? '',
    schedule: c.schedule ?? '',
    lines: c.lines ?? null,
  };
}

/** 从「我创建的」列表页带 edit=<id> 进来 → 表单初始值即回填（D-095）；找不到或不是自己的就当新建 */
function initialForm(edit?: string): FormInit {
  if (!edit) return BLANK_FORM;
  const c = useAppStore.getState().customCharacters.find((x) => x.id === edit && !x.shared);
  return c ? formFor(c) : BLANK_FORM;
}

/** 一组台词：一行一条（D-094） */
function LinesField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label={label}>
      <Input
        value={value.join('\n')}
        onChangeText={(text) => onChange(text.split('\n'))}
        placeholder={t('可不填')}
        multiline
        maxLength={400}
      />
    </Field>
  );
}

/** 选项 chip：label 过 t()，active → selected */
function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Chip label={t(label)} selected={active} onPress={onPress} />;
}

/** 三选一的小卡（节奏 / 主动强度）：白底 r6，选中 primary 白字 */
function PaceCard({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.paceCard, active && styles.paceCardOn]} onPress={onPress}>
      <Text style={[styles.paceLabel, active && styles.paceLabelOn]}>{t(label)}</Text>
      <Text style={[styles.paceHint, active && styles.paceHintOn]}>{t(hint)}</Text>
    </Pressable>
  );
}

export default function CreateScreen() {
  // 从「我创建的」列表页带 edit=<id> 进来 → 回填表单（D-095）：换一个 edit 就整表重挂载，初始值按它算
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  return <CreateForm key={edit ?? ''} edit={edit} />;
}

function CreateForm({ edit }: { edit?: string }) {
  const router = useRouter();
  // 表单初始值只算一次：新建为空白，edit 进来即回填
  const [init] = useState(() => initialForm(edit));

  // ── 编辑已创建的（D-050） ──
  const [editing, setEditing] = useState<Character | null>(init.editing);

  // ── 描述导入（D-043） ──
  const [desc, setDesc] = useState('');
  const [parsing, setParsing] = useState(false);

  // ── 基础 ──
  const [name, setName] = useState(init.name);
  const [gender, setGender] = useState<Gender>(init.gender);
  // 年龄状态（D-045）：发布必须确认成年；未成年走加强审查（试装不放行）
  const [ageStatus, setAgeStatus] = useState<'adult' | 'minor'>(init.ageStatus);
  // 可见性（D-060）：公开 = 进共享角色池，别人也能滑到；默认私密
  const [visibility, setVisibility] = useState<'private' | 'public'>(init.visibility);
  // 所在的世界（D-110）：现实世界 + 世界书里收藏的
  const [worldId, setWorldId] = useState<string | undefined>(init.worldId);
  const worlds = useAppStore((s) => s.worldBooks);
  const sharedWorlds = useAppStore((s) => s.sharedWorlds);
  const worldFavorites = useAppStore((s) => s.worldFavorites);
  const worldOptions = useMemo(() => selectableFrom(worlds, sharedWorlds, worldFavorites), [worlds, sharedWorlds, worldFavorites]);
  // 绑定了别人看不见的世界（自己的私密世界）→ 角色不能公开（D-111）
  const worldPublic = canPublishCharacter({ worldId });
  const [look, setLook] = useState(init.look);
  const [story, setStory] = useState(init.story);
  const [palette, setPalette] = useState(init.palette);
  const [portraitUri, setPortraitUri] = useState<string | undefined>(init.portraitUri);
  const [generating, setGenerating] = useState(false);
  // TA 的台词（D-094）：发布时模型写一次；编辑已创建的角色时可改、可让 TA 重写
  const [lines, setLines] = useState<CharacterLines | null>(init.lines);
  const [linesBusy, setLinesBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // 立绘画风（D-076）：注入生图 prompt 第一行；动漫走蒸汽机、其余走 Qwen
  const [artStyle, setArtStyle] = useState<ArtStyle>(init.artStyle);

  // ── 高级（新建默认收起，编辑时展开） ──
  const [advancedOpen, setAdvancedOpen] = useState(init.advancedOpen);
  const [race, setRace] = useState(init.race);
  const [raceCustom, setRaceCustom] = useState(init.raceCustom);
  // 生日下拉（D-045）：月 / 日 两级选单
  const [birthMonth, setBirthMonth] = useState<number | null>(init.birthMonth);
  const [birthDay, setBirthDay] = useState<number | null>(init.birthDay);
  const [pickerOpen, setPickerOpen] = useState<null | 'month' | 'day'>(null);
  const [catchphrase, setCatchphrase] = useState(init.catchphrase);
  const [likes, setLikes] = useState(init.likes);
  const [dislikes, setDislikes] = useState(init.dislikes);
  const [offerTurns, setOfferTurns] = useState(init.offerTurns);
  const [loveStyle, setLoveStyle] = useState<string | undefined>(init.loveStyle);
  const [mbti, setMbti] = useState<string | undefined>(init.mbti);
  // 创造扩展（D-045）
  const [initiative, setInitiative] = useState<'high' | 'mid' | 'low'>(init.initiative);
  const [presetMemories, setPresetMemories] = useState(init.presetMemories);
  const [taboos, setTaboos] = useState(init.taboos);
  const [secrets, setSecrets] = useState(init.secrets);
  const [chatNotes, setChatNotes] = useState(init.chatNotes);
  const [schedule, setSchedule] = useState(init.schedule);

  const finalRace = race === '其他' ? raceCustom.trim() : race;
  const birthday =
    birthMonth && birthDay
      ? `${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
      : '';
  const style = loveStyleByLabel(loveStyle);
  const allText = [
    desc, name, look, story, raceCustom, catchphrase, likes, dislikes,
    presetMemories, taboos, secrets, chatNotes, schedule,
  ]
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
    if (/^\d{1,2}-\d{1,2}$/.test(bd)) {
      const [bm, bday] = bd.split('-').map(Number);
      if (bm >= 1 && bm <= 12 && bday >= 1 && bday <= daysInMonth(bm)) {
        setBirthMonth(bm); setBirthDay(bday); advanced = true; n++;
      }
    }
    if (s(p.catchphrase)) { setCatchphrase(s(p.catchphrase).slice(0, 20)); advanced = true; n++; }
    if (s(p.likes)) { setLikes(s(p.likes).slice(0, 40)); advanced = true; n++; }
    if (s(p.dislikes)) { setDislikes(s(p.dislikes).slice(0, 40)); advanced = true; n++; }
    const ls = s(p.loveStyle);
    if (ls && LOVE_STYLES.some((l) => l.label === ls)) { setLoveStyle(ls); advanced = true; n++; }
    const mb = s(p.mbti).toUpperCase();
    if (MBTI_LIST.includes(mb)) { setMbti(mb); advanced = true; n++; }
    if (s(p.chatNotes)) { setChatNotes(s(p.chatNotes).slice(0, 120)); advanced = true; n++; }
    if (s(p.schedule)) { setSchedule(s(p.schedule).slice(0, 120)); advanced = true; n++; }
    const init = s(p.initiative);
    if (init === 'high' || init === 'mid' || init === 'low') { setInitiative(init); advanced = true; n++; }
    if (s(p.taboos)) { setTaboos(s(p.taboos).slice(0, 120)); advanced = true; n++; }
    if (s(p.presetMemories)) { setPresetMemories(s(p.presetMemories).slice(0, 200)); advanced = true; n++; }
    if (s(p.secrets)) { setSecrets(s(p.secrets).slice(0, 300)); advanced = true; n++; }
    if (advanced) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAdvancedOpen(true);
    }
    return n;
  };

  /** 自动解析：引擎整理成 JSON（prompt 见 content/prompts/create.ts）；AI 不可用/失败回落规则解析并说明原因（D-069） */
  const parseDesc = async () => {
    const text = desc.trim();
    if (!text || parsing) return;
    if (BLOCKED_NAME_PATTERN.test(text)) {
      Alert.alert(t('这个 TA 不能被创造出来'), t('描述里包含真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。'));
      return;
    }
    setParsing(true);
    let parsed: Record<string, unknown> | null = null;
    let aiError: string | null = null;
    try {
      const raw = await completeText(characterParseSystem(), text);
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      console.warn('[create] 引擎解析失败，回落规则解析：', e);
      parsed = null;
      aiError = describeAiError(e);
    }
    const n = applyParsed(parsed ?? heuristicParse(text));
    setParsing(false);
    const body = n ? t('填好了 {n} 项。往下检查一下，每一项都还能改。', { n }) : t('已把描述放进背景故事，其他项可以手动补。');
    Alert.alert(
      aiError ? t('模型解析失败，已用规则解析') : n ? t('解析好了') : t('没读出结构化的字段'),
      aiError ? `${body}\n\n${t('原因：{reason}', { reason: aiError })}` : body
    );
  };

  /** 表单里的 TA（还没入库）：预览与立绘生成共用 */
  const draftCharacter = (id = 'draft'): Character | null => {
    if (!name.trim()) return null;
    const g = GENDERS.find((x) => x.key === gender)!;
    const identitySrc = story.trim() || look.trim();
    return {
      id,
      // 自创角色带创建时的界面语言（D-093）：共享池只发给同语言用户，兜底脚本也按它取
      lang: getLang(),
      lines: lines ?? undefined,
      name: name.trim(),
      archetype: style?.archetype ?? 'gentle',
      loveTag: gender === 'nonbinary' ? 'nonbinary' : gender,
      gender,
      styleLabel: style?.label ?? t('自创'),
      identity: identitySrc ? identitySrc.slice(0, 18) : t('你亲手捏出来的 TA'),
      look: look.trim() || undefined,
      pronoun: g.pronoun,
      story: story.trim() || undefined,
      race: finalRace && finalRace !== '人类' ? finalRace : undefined,
      birthday: birthday || undefined,
      catchphrase: catchphrase.trim() || undefined,
      likes: likes.trim() || undefined,
      dislikes: dislikes.trim() || undefined,
      loveStyle: style?.label,
      mbti,
      chatNotes: chatNotes.trim() || undefined,
      schedule: schedule.trim() || undefined,
      adultConfirmed: ageStatus === 'adult' ? true : undefined,
      visibility,
      worldId: worldId && worldId !== REAL_WORLD_ID ? worldId : undefined,
      initiative,
      presetMemories: presetMemories.trim() || undefined,
      taboos: taboos.trim() || undefined,
      secrets: secrets.trim() || undefined,
      artStyle,
      offerAfterTurns: offerTurns,
      hook: style ? style.desc.split('；')[0] : t('TA 在等一个点开 TA 的人。'),
      intro: t('……你捏出来的 TA，正在看你。'),
      tags: [t('自创'), ...(style ? [style.label] : []), ...(finalRace && finalRace !== '人类' ? [finalRace] : [])].slice(0, 3),
      adoptedCount: 0,
      ...PALETTES[palette],
      custom: true,
    };
  };

  const guard = (): boolean => {
    if (BLOCKED_NAME_PATTERN.test(allText)) {
      Alert.alert(t('这个 TA 不能被创造出来'), t('不能创造真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。'));
      return false;
    }
    return true;
  };

  /** 上传头像（D-045）：相册选图；红线 #1——不收真人照片（试装为自我声明，真人检测见 OPEN_QUESTIONS #14） */
  const uploadAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPortraitUri(result.assets[0].uri);
    }
  };

  const genPortrait = async () => {
    const draft = draftCharacter();
    if (!draft) return;
    if (!imageKeyReady()) {
      Alert.alert(t('AI 不可用'), t('立绘与聊天共用千帆 key：在 .env.local 配置，或登录后走服务端代理。'));
      return;
    }
    if (!guard()) return;
    setGenerating(true);
    try {
      setPortraitUri(await generatePortraitFor(draft));
    } catch (e) {
      console.warn('[create] 立绘生成失败：', e);
      Alert.alert(
        t('立绘没画出来'),
        `${t('网络或生图服务出了点问题，可以再试一次，或先跳过（醒来后会在后台补画）。')}\n\n${t('原因：{reason}', { reason: describeAiError(e) })}`
      );
    } finally {
      setGenerating(false);
    }
  };

  /** 公开角色上传共享池（D-060）；未登录/失败回落私密并提示。绑定的世界以快照嵌入（D-111） */
  const publishIfPublic = async (character: Character): Promise<Character> => {
    if (character.visibility !== 'public') return character;
    if (!canPublishCharacter(character)) return { ...character, visibility: 'private' };
    const ok = await publishCharacter({ ...character, world: worldSnapshotFor(character) });
    if (!ok) {
      Alert.alert(t('先按私密保存了'), t('公开需要登录，登录后可以再改。'));
      return { ...character, visibility: 'private' };
    }
    return character;
  };

  const submit = async () => {
    if (!name.trim()) return;
    if (!guard()) return;

    // 编辑已创建的角色（D-050）：原位更新，不动热度与羁绊
    if (editing) {
      let character = draftCharacter(editing.id);
      if (!character) return;
      character = { ...character, adoptedCount: editing.adoptedCount };
      character = await publishIfPublic(character);
      // 公开 → 私密：从共享池撤下（D-060）
      if (editing.visibility === 'public' && character.visibility !== 'public') {
        void unpublishCharacter(editing.id);
      }
      useAppStore.getState().updateCustomCharacter(character);
      if (portraitUri) useAppStore.getState().setPortrait(editing.id, portraitUri);
      setEditing(null);
      resetForm();
      Alert.alert(t('已保存'), t('TA 的设定更新了。'));
      return;
    }

    const id = uid('c');
    let character = draftCharacter(id);
    if (!character) return;
    // TA 的台词（D-094）：按人设写一次；写不成先用原型兜底，之后可在「我创建的」里让 TA 重写
    setPublishing(true);
    const written = await generateCharacterLines(character);
    setPublishing(false);
    if (written) character = { ...character, lines: written };
    else showToast(t('台词先用通用版，可在「我创建的」里改'));
    // 强制登录判定（D-062）：这是不是第一次把人添加进通讯录
    const s = useAppStore.getState();
    const hadContacts = s.bonds.length > 0 || s.customCharacters.some((c) => !c.shared);
    character = await publishIfPublic(character);
    useAppStore.getState().addCustomCharacter(character);
    // 形象必选（D-092）：发布前已保证 portraitUri 存在
    if (portraitUri) useAppStore.getState().setPortrait(id, portraitUri);
    // 自创角色直入通讯录（D-052 修订 D-047）：带「心动中」tag 的暧昧期——
    // 心动满 100 TA 才会想确定关系，那时才占槽、才开始羁绊等级
    useAppStore.getState().ensureSquareChat(id);
    resetForm();
    if (!hadContacts && authConfigured() && !(await signedInSession())) {
      // 首次入册 → 强制登录（D-062）：TA 值得一个存得住的家
      router.replace({ pathname: '/auth', params: { force: '1' } });
      return;
    }
    Alert.alert(t('TA 醒过来了'), t('TA 在等你说第一句话。'), [
      {
        text: t('去和 TA 说话'),
        onPress: () => router.push({ pathname: '/chat/[characterId]', params: { characterId: id } }),
      },
      { text: t('再创造一个'), style: 'cancel' },
    ]);
  };

  const resetForm = () => {
    setDesc(''); setName(''); setLook(''); setStory(''); setPortraitUri(undefined); setArtStyle(DEFAULT_PORTRAIT_STYLE);
    setAgeStatus('adult'); setVisibility('private'); setWorldId(undefined); setRace('人类'); setRaceCustom('');
    setBirthMonth(null); setBirthDay(null); setCatchphrase('');
    setLikes(''); setDislikes(''); setOfferTurns(4); setLoveStyle(undefined);
    setMbti(undefined); setInitiative('mid'); setPresetMemories(''); setTaboos(''); setSecrets('');
    setChatNotes(''); setSchedule(''); setAdvancedOpen(false); setLines(null);
  };

  /** 编辑时让 TA 按当前表单重写一遍台词（D-094）；写不成保留原来的 */
  const rewriteLines = async () => {
    if (linesBusy) return;
    const draft = draftCharacter(editing?.id ?? 'draft');
    if (!draft) return;
    setLinesBusy(true);
    const written = await generateCharacterLines({ ...draft, lines: undefined });
    setLinesBusy(false);
    if (written) setLines(written);
    else showToast(t('没写成，先保留原来的'));
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  const publishLabel = publishing
    ? t('正在给 TA 写台词…')
    : ageStatus === 'minor'
      ? t('未成年角色暂不能发布')
      : !portraitUri
        ? t('先给 TA 一个形象')
        : editing
          ? t('保存修改')
          : t('让 TA 醒来');

  return (
    <AppScreen
      title={t('创造')}
      right={<HeaderAction label={t('我创建的')} onPress={() => router.push('/apps/my-characters' as never)} />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('创造一个只属于你的 TA')}</Text>

          {editing ? (
            <View style={styles.editingBanner}>
              <Text style={styles.editingText}>{t('正在编辑「{name}」——改完点底部保存', { name: editing.name })}</Text>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  resetForm();
                }}
                hitSlop={8}>
                <Text style={styles.editingCancel}>{t('取消')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ───────── 描述导入（D-043） ───────── */}
          <Field
            label={t('用一段话描述 TA（可选）')}
            hint={t('小说片段、角色卡、脑子里的画面都行，最多 {n} 字。', { n: DESC_MAX })}>
            <Input
              value={desc}
              onChangeText={setDesc}
              placeholder={t('银灰色头发的年轻外科医生，毒舌但心软。父母常年在国外，一个人住在老城区……')}
              multiline
              maxLength={DESC_MAX}
            />
          </Field>
          <View style={styles.descFoot}>
            <Text style={styles.descCount}>
              {desc.length}/{DESC_MAX}
            </Text>
            <View style={styles.btnRow}>
              {parsing ? <ActivityIndicator color={Romance.accent} size="small" /> : null}
              <Button
                label={parsing ? t('解析中…') : t('自动解析')}
                size="sm"
                disabled={!desc.trim() || parsing}
                onPress={parseDesc}
              />
            </View>
          </View>

          {/* ───────── 基础 ───────── */}
          <Field label={t('① TA 叫什么')}>
            <Input value={name} onChangeText={setName} placeholder={t('给 TA 一个名字')} maxLength={12} />
          </Field>

          <Field label={t('② TA 的性别')}>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <OptionChip key={g.key} label={g.label} active={gender === g.key} onPress={() => setGender(g.key)} />
              ))}
            </View>
          </Field>

          <Field label={t('③ 年龄状态')}>
            <View style={styles.chipRow}>
              <OptionChip label={t('确认成年')} active={ageStatus === 'adult'} onPress={() => setAgeStatus('adult')} />
              <OptionChip label={t('未成年')} active={ageStatus === 'minor'} onPress={() => setAgeStatus('minor')} />
            </View>
          </Field>
          {ageStatus === 'minor' ? (
            <Text style={styles.minorNotice}>
              {t('未成年角色不开放恋爱互动，暂时不能发布。')}
            </Text>
          ) : (
            <Text style={styles.afterHint}>{t('发布即确认 TA 是成年人。')}</Text>
          )}

          <Field label={t('④ 谁能遇到 TA')}>
            <View style={styles.chipRow}>
              <OptionChip label={t('私密')} active={visibility === 'private'} onPress={() => setVisibility('private')} />
              {worldPublic ? (
                <OptionChip label={t('公开')} active={visibility === 'public'} onPress={() => setVisibility('public')} />
              ) : null}
            </View>
          </Field>
          <Text style={styles.afterHint}>
            {!worldPublic
              ? t('TA 所在的世界别人看不见，所以 TA 不能公开。把那个世界设为公开后再试。')
              : visibility === 'public'
                ? t('公开：其他人也能遇到 TA（需要登录）。')
                : t('私密：只有你能遇到 TA。')}
          </Text>

          {/* 所在的世界（D-110）：现实世界永远在，之后是世界书里收藏的 */}
          <Field label={t('TA 所在的世界')} hint={t('在世界书里收藏的世界才会出现在这里。')}>
            <View style={styles.chipRow}>
              {worldOptions.map((w) => (
                <OptionChip
                  key={w.id}
                  label={w.id === REAL_WORLD_ID ? t(w.name) : w.name}
                  active={(worldId ?? REAL_WORLD_ID) === w.id}
                  onPress={() => {
                    const next = w.id === REAL_WORLD_ID ? undefined : w.id;
                    setWorldId(next);
                    // 选了别人看不见的世界 → 公开自动收回私密（D-111）
                    if (!canPublishCharacter({ worldId: next })) setVisibility('private');
                  }}
                />
              ))}
            </View>
          </Field>

          <Field label={t('⑤ TA 长什么样')}>
            <Input
              value={look}
              onChangeText={setLook}
              placeholder={t('银灰色头发，眼下有一颗泪痣，笑起来很凶……')}
              multiline
              maxLength={60}
              style={styles.inputShort}
            />
          </Field>
          <Text style={styles.afterHint}>{t('TA 的主题色：')}</Text>
          <View style={styles.paletteRow}>
            {PALETTES.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => setPalette(i)}
                style={[styles.swatchRing, palette === i && styles.swatchRingOn]}>
                <View style={[styles.swatch, { backgroundColor: p.color }]} />
              </Pressable>
            ))}
          </View>

          <Field label={t('⑥ TA 的背景故事')}>
            <Input
              value={story}
              onChangeText={setStory}
              placeholder={t('TA 是谁、从哪里来、身上背着什么故事……')}
              multiline
              maxLength={300}
            />
          </Field>

          <Field label={t('⑦ TA 的形象 *')} hint={t('上传一张图，或生成立绘。不能上传真人照片。')}>
            <Text style={styles.subLabel}>{t('画风：')}</Text>
            <View style={styles.chipRow}>
              {PORTRAIT_STYLES.map((s) => (
                <OptionChip key={s.id} label={t(s.label)} active={artStyle === s.id} onPress={() => setArtStyle(s.id)} />
              ))}
            </View>
            <Text style={styles.afterHint}>
              {artStyle === 'anime'
                ? t('出图约 10 秒。')
                : t('出图约 1 分钟。')}
            </Text>
            {portraitUri ? (
              <Image source={{ uri: portraitUri }} style={styles.portrait} contentFit="cover" />
            ) : null}
            <View style={styles.portraitBtnRow}>
              <Button
                label={portraitUri ? t('换一张') : t('上传头像')}
                variant="secondary"
                size="md"
                style={styles.portraitBtn}
                onPress={uploadAvatar}
              />
              <Button
                label={generating ? t('生成中…') : imageKeyReady() ? t('生成立绘') : t('生成立绘（AI 不可用）')}
                variant="outline"
                size="md"
                style={styles.portraitBtn}
                disabled={!name.trim() || generating}
                onPress={genPortrait}
              />
            </View>
          </Field>

          {/* ───────── 高级选项（收起） ───────── */}
          <Pressable style={styles.advToggle} onPress={toggleAdvanced}>
            <Text style={styles.advToggleText}>{advancedOpen ? t('收起高级选项 ▴') : t('高级选项 ▾')}</Text>
            <Text style={styles.advToggleHint}>{t('种族 · 生日 · 口癖 · 恋爱类型 · MBTI · 作息…')}</Text>
          </Pressable>

          {advancedOpen ? (
            <View>
              <Field label={t('种族')}>
                <View style={styles.chipRow}>
                  {[...RACES, '其他'].map((r) => (
                    <OptionChip key={r} label={r} active={race === r} onPress={() => setRace(r)} />
                  ))}
                </View>
                {race === '其他' ? (
                  <Input
                    style={styles.raceCustomInput}
                    value={raceCustom}
                    onChangeText={setRaceCustom}
                    placeholder={t('如：半人马')}
                    maxLength={10}
                  />
                ) : null}
              </Field>

              <Field label={t('TA 的生日')}>
                <View style={styles.chipRow}>
                  <Pressable style={styles.ddBtn} onPress={() => setPickerOpen('month')}>
                    <Text style={[styles.ddText, !birthMonth && styles.ddTextEmpty]}>
                      {birthMonth ? t('{n} 月', { n: birthMonth }) : t('月份 ▾')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.ddBtn, !birthMonth && styles.btnDisabled]}
                    disabled={!birthMonth}
                    onPress={() => setPickerOpen('day')}>
                    <Text style={[styles.ddText, !birthDay && styles.ddTextEmpty]}>
                      {birthDay ? t('{n} 日', { n: birthDay }) : t('日期 ▾')}
                    </Text>
                  </Pressable>
                  {birthMonth ? (
                    <Pressable
                      style={styles.ddClear}
                      onPress={() => {
                        setBirthMonth(null);
                        setBirthDay(null);
                      }}>
                      <Text style={styles.ddClearText}>{t('清除')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Field>

              <Field label={t('口癖')} hint={t('TA 挂在嘴边的话。')}>
                <Input
                  value={catchphrase}
                  onChangeText={setCatchphrase}
                  placeholder="「……真拿你没办法」"
                  maxLength={20}
                />
              </Field>

              <Field label={t('喜欢')}>
                <Input
                  value={likes}
                  onChangeText={setLikes}
                  placeholder={t('黑咖啡、下雨天、猫……')}
                  maxLength={40}
                />
              </Field>

              <Field label={t('讨厌')}>
                <Input
                  value={dislikes}
                  onChangeText={setDislikes}
                  placeholder={t('香菜、迟到、被拍头……')}
                  maxLength={40}
                />
              </Field>

              <Field label={t('确定关系的节奏')}>
                <View style={styles.chipRow}>
                  {OFFER_PACES.map((p) => (
                    <PaceCard
                      key={p.turns}
                      label={p.label}
                      hint={p.hint}
                      active={offerTurns === p.turns}
                      onPress={() => setOfferTurns(p.turns)}
                    />
                  ))}
                </View>
              </Field>

              <Field label={t('TA 在恋爱中的类型')}>
                <View style={styles.chipRow}>
                  {LOVE_STYLES.map((l) => (
                    <OptionChip
                      key={l.label}
                      label={l.label}
                      active={loveStyle === l.label}
                      onPress={() => setLoveStyle(loveStyle === l.label ? undefined : l.label)}
                    />
                  ))}
                </View>
                {style ? <Text style={styles.styleDesc}>{style.desc}</Text> : null}
              </Field>

              <Field label="MBTI">
                <View style={styles.chipRow}>
                  {MBTI_LIST.map((m) => (
                    <OptionChip
                      key={m}
                      label={m}
                      active={mbti === m}
                      onPress={() => setMbti(mbti === m ? undefined : m)}
                    />
                  ))}
                </View>
              </Field>

              <Field label={t('主动联系强度')}>
                <View style={styles.chipRow}>
                  {INITIATIVES.map((it) => (
                    <PaceCard
                      key={it.key}
                      label={it.label}
                      hint={it.hint}
                      active={initiative === it.key}
                      onPress={() => setInitiative(it.key)}
                    />
                  ))}
                </View>
              </Field>

              <Field label={t('预设共同记忆')} hint={t('你们「早就认识」的部分，一行一条。')}>
                <Input
                  value={presetMemories}
                  onChangeText={setPresetMemories}
                  placeholder={t('高中同桌三年，TA 总抄你的笔记\n去年冬天一起看过一场雪')}
                  multiline
                  maxLength={200}
                />
              </Field>

              <Field label={t('禁忌 / 边界')} hint={t('TA 不做的事、回避的话题。')}>
                <Input
                  value={taboos}
                  onChangeText={setTaboos}
                  placeholder="不谈家里的事；不喝酒；被问到左手的疤会岔开话题……"
                  multiline
                  maxLength={120}
                />
              </Field>

              <Field label={t('隐藏设定 / 剧情钩子')} hint={t('TA 藏着的事，一行一条、浅的在前。')}>
                <Input
                  value={secrets}
                  onChangeText={setSecrets}
                  placeholder={t('其实注册交友软件只是为了找一个人\n左手的疤是替别人挡下来的\n真实身份是……')}
                  multiline
                  maxLength={300}
                />
              </Field>

              <Field label={t('其他关于聊天的设定')}>
                <Input
                  value={chatNotes}
                  onChangeText={setChatNotes}
                  placeholder="如：会用一点方言；不主动发语音；叫我「小朋友」……"
                  multiline
                  maxLength={120}
                />
              </Field>

              <Field label={t('日常作息')} hint={t('TA 的一天怎么过。')}>
                <Input
                  value={schedule}
                  onChangeText={setSchedule}
                  placeholder="早八晚六上班，周三晚上健身，习惯凌晨一点睡……"
                  multiline
                  maxLength={120}
                />
              </Field>
            </View>
          ) : null}

          {/* TA 的台词（D-094）：只在编辑已创建的角色时显示——发布时模型已写好一份，这里可逐条改、可让 TA 重写 */}
          {editing ? (
            <View>
              <Text style={styles.sectionTitle}>{t('TA 的台词')}</Text>
              <Text style={styles.sectionHint}>{t('每行一条')}</Text>
              <LinesField
                label={t('开场白')}
                value={lines?.opening ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), opening: v })}
              />
              <LinesField
                label={t('想确定关系时')}
                value={lines?.offer ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), offer: v })}
              />
              <LinesField
                label={t('确定关系后的第一句')}
                value={lines?.arrival ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), arrival: v })}
              />
              <Field label={t('一句话人设')}>
                <Input
                  value={lines?.persona ?? ''}
                  onChangeText={(v) => setLines({ ...(lines ?? EMPTY_LINES), persona: v })}
                  placeholder={t('可不填')}
                  multiline
                  maxLength={120}
                />
              </Field>
              <Field label={t('追法')}>
                <Input
                  value={lines?.pursuit ?? ''}
                  onChangeText={(v) => setLines({ ...(lines ?? EMPTY_LINES), pursuit: v })}
                  placeholder={t('可不填')}
                  multiline
                  maxLength={160}
                />
              </Field>
              <Button
                label={linesBusy ? t('正在写…') : t('让 TA 重新写一遍')}
                variant="outline"
                size="md"
                style={styles.rewriteBtn}
                disabled={linesBusy}
                onPress={rewriteLines}
              />
            </View>
          ) : null}

          {/* 预览 + 醒来 */}
          {name.trim() ? (
            <Card style={styles.previewCard}>
              <CharAvatar name={name.trim()} color={PALETTES[palette].color} size={44} uri={portraitUri} />
              <View style={styles.previewText}>
                <Text style={styles.previewName}>{name.trim()}</Text>
                <Text style={styles.previewHook} numberOfLines={1}>
                  {[GENDERS.find((g) => g.key === gender)?.label, style?.label, finalRace !== '人类' ? finalRace : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Card>
          ) : null}

          <Button
            label={publishLabel}
            style={styles.primaryBtn}
            disabled={!name.trim() || !portraitUri || ageStatus === 'minor' || publishing}
            onPress={submit}
          />
          <Text style={styles.footnote}>{t('不能创造真人与 IP 角色 · 发布即默认同意创作规范')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 生日下拉选单（D-045）：paper 底的底部面板，月 / 日按 chip 选 */}
      <Modal
        visible={pickerOpen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(null)}>
        <Pressable style={styles.pickerMask} onPress={() => setPickerOpen(null)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{pickerOpen === 'month' ? t('选择月份') : t('选择日期')}</Text>
            <ScrollView contentContainerStyle={styles.pickerGrid}>
              {(pickerOpen === 'month'
                ? MONTH_OPTIONS
                : Array.from({ length: daysInMonth(birthMonth ?? 1) }, (_, i) => i + 1)
              ).map((n) => {
                const active = (pickerOpen === 'month' ? birthMonth : birthDay) === n;
                return (
                  <Chip
                    key={n}
                    label={pickerOpen === 'month' ? t('{n} 月', { n }) : t('{n} 日', { n })}
                    selected={active}
                    onPress={() => {
                      if (pickerOpen === 'month') {
                        setBirthMonth(n);
                        if (birthDay && birthDay > daysInMonth(n)) setBirthDay(null);
                        setPickerOpen('day');
                      } else {
                        setBirthDay(n);
                        setPickerOpen(null);
                      }
                    }}
                  />
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    // 表单类页面左右留白按设计稿 18
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    subtitle: { fontSize: 13, color: Romance.sub, marginTop: Space.inlineLoose },
    editingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radius,
      paddingHorizontal: Space.cardX,
      paddingVertical: Space.cardY,
      marginTop: Space.inlineLoose,
    },
    editingText: { flex: 1, fontSize: 12, fontWeight: '600', color: Romance.accent },
    editingCancel: { fontSize: 12, color: Romance.sub },
    descFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Space.inline,
    },
    descCount: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    inputShort: { minHeight: 64 },
    afterHint: { fontSize: 11, color: Romance.sub, marginTop: Space.inline, lineHeight: 16 },
    minorNotice: {
      fontSize: 12,
      color: Romance.danger,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radius,
      paddingHorizontal: Space.cardX,
      paddingVertical: Space.cardY,
      marginTop: Space.inline,
      lineHeight: 18,
    },
    subLabel: { fontSize: 13, fontWeight: '500', color: Romance.ink, marginBottom: Space.inline },
    paletteRow: { flexDirection: 'row', gap: Space.inline, marginTop: Space.inline },
    swatchRing: {
      borderWidth: SWATCH_RING.width,
      borderColor: 'transparent',
      padding: SWATCH_RING.gap,
      borderRadius: Shape.radius + SWATCH_RING.gap + SWATCH_RING.width,
    },
    swatchRingOn: { borderColor: Romance.ink },
    swatch: { width: 32, height: 32, borderRadius: Shape.radius },
    portrait: { width: 180, height: 180, borderRadius: Shape.radius, alignSelf: 'center', marginTop: Space.inlineLoose },
    portraitBtnRow: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: Space.inlineLoose },
    portraitBtn: { flex: 1 },
    advToggle: {
      marginTop: 26,
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      padding: Space.screen,
      alignItems: 'center',
    },
    advToggleText: { fontSize: 14, fontWeight: '600', color: Romance.accent },
    advToggleHint: { fontSize: 11, color: Romance.sub, marginTop: 3 },
    raceCustomInput: { marginTop: Space.inlineLoose },
    ddBtn: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    ddText: { fontSize: 14, fontWeight: '500', color: Romance.ink },
    ddTextEmpty: { color: Romance.sub },
    ddClear: { justifyContent: 'center', paddingHorizontal: Space.inline },
    ddClearText: { fontSize: 12, color: Romance.sub },
    btnDisabled: { opacity: 0.4 },
    paceCard: {
      flex: 1,
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingVertical: Space.cardX,
      paddingHorizontal: Space.cardY,
      alignItems: 'center',
    },
    paceCardOn: { backgroundColor: Romance.accent },
    paceLabel: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    paceLabelOn: { color: '#FFFFFF' },
    paceHint: { fontSize: 10, color: Romance.sub, marginTop: 3 },
    paceHintOn: { color: 'rgba(255,255,255,0.8)' },
    styleDesc: {
      fontSize: 12,
      color: Romance.accent,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radius,
      paddingHorizontal: Space.cardX,
      paddingVertical: Space.cardY,
      marginTop: Space.inlineLoose,
      lineHeight: 18,
    },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 28 },
    sectionHint: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    rewriteBtn: { marginTop: Space.cardX },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      marginTop: 24,
    },
    previewText: { flex: 1 },
    previewName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    previewHook: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    primaryBtn: { marginTop: Space.screen },
    footnote: { textAlign: 'center', fontSize: 11, color: Romance.sub, marginTop: Space.cardX },
    // 生日选单：ink 45% 遮罩 + paper 底面板（1.5px ink 上沿，同输入栏）
    pickerMask: {
      flex: 1,
      backgroundColor: withAlpha(Romance.ink, 0.45),
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: Romance.bg,
      borderTopLeftRadius: Shape.radius,
      borderTopRightRadius: Shape.radius,
      borderTopWidth: Shape.stroke,
      borderTopColor: Romance.stroke,
      paddingTop: 18,
      paddingBottom: 30,
      maxHeight: '60%',
    },
    pickerTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: Romance.ink,
      textAlign: 'center',
      marginBottom: Space.cardX,
    },
    pickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Space.inline,
      paddingHorizontal: 18,
      paddingBottom: Space.inlineLoose,
    },
  })
);
