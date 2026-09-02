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
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { BLOCKED_NAME_PATTERN, LOVE_STYLES, loveStyleByLabel, RACES } from '@/content/characters';
import { CHARACTER_PARSE_SYSTEM } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { authConfigured, currentSession } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { completeText, describeAiError } from '@/lib/engine';
import { uid } from '@/lib/format';
import { ensurePortrait, generatePortraitFor, imageKeyReady } from '@/lib/imagegen';
import { publishCharacter, unpublishCharacter } from '@/lib/pool';
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(label)}</Text>
    </Pressable>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const customs = useAppStore((s) => s.customCharacters);

  // ── 编辑已创建的（D-050） ──
  const [editing, setEditing] = useState<Character | null>(null);

  // ── 描述导入（D-043） ──
  const [desc, setDesc] = useState('');
  const [parsing, setParsing] = useState(false);

  // ── 基础 ──
  const [name, setName] = useState('');
  const [gender, setGender] = useState<(typeof GENDERS)[number]['key']>('male');
  // 年龄状态（D-045）：发布必须确认成年；未成年走加强审查（试装不放行）
  const [ageStatus, setAgeStatus] = useState<'adult' | 'minor'>('adult');
  // 可见性（D-060）：公开 = 进共享角色池，别人也能滑到；默认私密
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [look, setLook] = useState('');
  const [story, setStory] = useState('');
  const [palette, setPalette] = useState(0);
  const [portraitUri, setPortraitUri] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);

  // ── 高级（默认收起） ──
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [race, setRace] = useState('人类');
  const [raceCustom, setRaceCustom] = useState('');
  // 生日下拉（D-045）：月 / 日 两级选单
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'month' | 'day'>(null);
  const [catchphrase, setCatchphrase] = useState('');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [offerTurns, setOfferTurns] = useState(4);
  const [loveStyle, setLoveStyle] = useState<string | undefined>();
  const [mbti, setMbti] = useState<string | undefined>();
  // 创造扩展（D-045）
  const [initiative, setInitiative] = useState<'high' | 'mid' | 'low'>('mid');
  const [presetMemories, setPresetMemories] = useState('');
  const [taboos, setTaboos] = useState('');
  const [secrets, setSecrets] = useState('');
  const [chatNotes, setChatNotes] = useState('');
  const [schedule, setSchedule] = useState('');

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

  /** 自动解析：引擎整理成 JSON（prompt 见 content/prompts.ts）；AI 不可用/失败回落规则解析并说明原因（D-069） */
  const parseDesc = async () => {
    const text = desc.trim();
    if (!text || parsing) return;
    if (BLOCKED_NAME_PATTERN.test(text)) {
      Alert.alert('这个 TA 不能被创造出来', '描述里包含真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。');
      return;
    }
    setParsing(true);
    let parsed: Record<string, unknown> | null = null;
    let aiError: string | null = null;
    try {
      const raw = await completeText(CHARACTER_PARSE_SYSTEM, text);
      const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      console.warn('[create] 引擎解析失败，回落规则解析：', e);
      parsed = null;
      aiError = describeAiError(e);
    }
    const n = applyParsed(parsed ?? heuristicParse(text));
    setParsing(false);
    const body = n ? `填好了 ${n} 项。往下检查一下，每一项都还能改。` : '已把描述放进背景故事，其他项可以手动补。';
    Alert.alert(
      aiError ? '模型解析失败，已用规则解析' : n ? '解析好了' : '没读出结构化的字段',
      aiError ? `${body}\n\n原因：${aiError}` : body
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
      initiative,
      presetMemories: presetMemories.trim() || undefined,
      taboos: taboos.trim() || undefined,
      secrets: secrets.trim() || undefined,
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
      Alert.alert('AI 不可用', '立绘与聊天共用千帆 key：在 .env.local 配置，或登录后走服务端代理。');
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

  /** 公开角色上传共享池（D-060）；未登录/失败回落私密并提示 */
  const publishIfPublic = async (character: Character): Promise<Character> => {
    if (character.visibility !== 'public') return character;
    const ok = await publishCharacter(character);
    if (!ok) {
      Alert.alert(t('先按私密保存了'), t('公开到共享池需要登录账号，登录后再编辑改公开即可。'));
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
    // 强制登录判定（D-062）：这是不是第一次把人添加进通讯录
    const s = useAppStore.getState();
    const hadContacts = s.bonds.length > 0 || s.customCharacters.some((c) => !c.shared);
    character = await publishIfPublic(character);
    useAppStore.getState().addCustomCharacter(character);
    if (portraitUri) useAppStore.getState().setPortrait(id, portraitUri);
    else if (imageKeyReady()) void ensurePortrait(id);
    // 自创角色直入通讯录（D-052 修订 D-047）：带「心动中」tag 的暧昧期——
    // 心动满 100 TA 才会想确定关系，那时才占槽、才开始羁绊等级
    useAppStore.getState().ensureSquareChat(id);
    resetForm();
    if (!hadContacts && authConfigured() && !(await currentSession())) {
      // 首次入册 → 强制登录（D-062）：TA 值得一个存得住的家
      router.replace({ pathname: '/auth', params: { force: '1' } });
      return;
    }
    Alert.alert(t('TA 醒过来了'), t('TA 已经在你的通讯录里，等你去说第一句话。'), [
      {
        text: t('去和 TA 说话'),
        onPress: () => router.push({ pathname: '/chat/[characterId]', params: { characterId: id } }),
      },
      { text: t('再创造一个'), style: 'cancel' },
    ]);
  };

  const resetForm = () => {
    setDesc(''); setName(''); setLook(''); setStory(''); setPortraitUri(undefined);
    setAgeStatus('adult'); setVisibility('private'); setRace('人类'); setRaceCustom('');
    setBirthMonth(null); setBirthDay(null); setCatchphrase('');
    setLikes(''); setDislikes(''); setOfferTurns(4); setLoveStyle(undefined);
    setMbti(undefined); setInitiative('mid'); setPresetMemories(''); setTaboos(''); setSecrets('');
    setChatNotes(''); setSchedule(''); setAdvancedOpen(false);
  };

  /** 编辑已创建的角色（D-050）：全部字段回填进表单 */
  const loadForEdit = (c: Character) => {
    setEditing(c);
    setDesc('');
    setName(c.name);
    setGender(c.gender ?? (c.loveTag === 'female' ? 'female' : c.loveTag === 'nonbinary' ? 'nonbinary' : 'male'));
    setAgeStatus('adult'); // 已发布的都确认过成年
    setVisibility(c.visibility ?? 'private');
    setLook(c.look ?? '');
    setStory(c.story ?? '');
    const pi = PALETTES.findIndex((p) => p.color === c.color);
    setPalette(pi >= 0 ? pi : 0);
    setPortraitUri(useAppStore.getState().portraits[c.id]);
    if (!c.race) {
      setRace('人类'); setRaceCustom('');
    } else if (RACES.includes(c.race)) {
      setRace(c.race); setRaceCustom('');
    } else {
      setRace('其他'); setRaceCustom(c.race);
    }
    if (c.birthday && /^\d{1,2}-\d{1,2}$/.test(c.birthday)) {
      const [bm, bd] = c.birthday.split('-').map(Number);
      setBirthMonth(bm); setBirthDay(bd);
    } else {
      setBirthMonth(null); setBirthDay(null);
    }
    setCatchphrase(c.catchphrase ?? '');
    setLikes(c.likes ?? '');
    setDislikes(c.dislikes ?? '');
    setOfferTurns(c.offerAfterTurns ?? 4);
    setLoveStyle(c.loveStyle);
    setMbti(c.mbti);
    setInitiative(c.initiative ?? 'mid');
    setPresetMemories(c.presetMemories ?? '');
    setTaboos(c.taboos ?? '');
    setSecrets(c.secrets ?? '');
    setChatNotes(c.chatNotes ?? '');
    setSchedule(c.schedule ?? '');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen(true);
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  return (
    <AppScreen title={t("创造")}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('创造一个只属于你的 TA')}</Text>

          {/* ───────── 我创建的（D-050）：点编辑回填表单 ───────── */}
          {customs.filter((c) => !c.shared).length > 0 && (
            <View>
              <Text style={styles.step}>{t('我创建的')}（{customs.filter((c) => !c.shared).length}）</Text>
              {customs.filter((c) => !c.shared).map((c) => (
                <View key={c.id} style={styles.mineRow}>
                  <CharAvatar name={c.name} color={c.color} size={40} characterId={c.id} />
                  <View style={styles.mineText}>
                    <Text style={styles.mineName}>{c.name}</Text>
                    <Text style={styles.mineSub} numberOfLines={1}>
                      {c.visibility === 'public' ? t('公开') : t('私密')} · {c.identity}
                    </Text>
                  </View>
                  <Pressable style={styles.mineEditBtn} onPress={() => loadForEdit(c)}>
                    <Text style={styles.mineEditText}>{t('编辑')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
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
          <Text style={styles.step}>{t('用一段话描述 TA（可选）')}</Text>
          <Text style={styles.stepHint}>
            {t('写下或粘贴一段人设——小说片段、角色卡、脑子里的画面都行，最多 {n} 字。点「自动解析」帮你填好下面的表单，每一项都还能改。', { n: DESC_MAX })}
          </Text>
          <TextInput
            style={[styles.input, styles.inputDesc]}
            value={desc}
            onChangeText={setDesc}
            placeholder={t('银灰色头发的年轻外科医生，毒舌但心软。父母常年在国外，一个人住在老城区……')}
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
                  <Text style={styles.parseBtnText}>{t('解析中…')}</Text>
                </View>
              ) : (
                <Text style={styles.parseBtnText}>{t('自动解析')}</Text>
              )}
            </Pressable>
          </View>

          {/* ───────── 基础 ───────── */}
          <Text style={styles.step}>{t('① TA 叫什么')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('给 TA 一个名字')}
            placeholderTextColor={Romance.faint}
            maxLength={12}
          />

          <Text style={styles.step}>{t('② TA 的性别')}</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Chip key={g.key} label={g.label} active={gender === g.key} onPress={() => setGender(g.key)} />
            ))}
          </View>

          <Text style={styles.step}>{t('③ 年龄状态')}</Text>
          <View style={styles.chipRow}>
            <Chip label={t("确认成年")} active={ageStatus === 'adult'} onPress={() => setAgeStatus('adult')} />
            <Chip label={t("未成年")} active={ageStatus === 'minor'} onPress={() => setAgeStatus('minor')} />
          </View>
          {ageStatus === 'minor' ? (
            <Text style={styles.minorNotice}>
              {t('未成年角色进入加强审查通道，且不开放恋爱互动。试装还没接审查系统，暂时不能发布。')}
            </Text>
          ) : (
            <Text style={styles.afterHint}>{t('发布即确认 TA 是成年人。')}</Text>
          )}

          <Text style={styles.step}>{t('④ 谁能遇到 TA')}</Text>
          <View style={styles.chipRow}>
            <Chip label={t("私密")} active={visibility === 'private'} onPress={() => setVisibility('private')} />
            <Chip label={t("公开")} active={visibility === 'public'} onPress={() => setVisibility('public')} />
          </View>
          <Text style={styles.afterHint}>
            {visibility === 'public'
              ? t('公开：TA 会进入共享角色池，其他玩家也能在交友里滑到 TA（需要登录账号）。')
              : t('私密：只有你能遇到 TA。')}
          </Text>

          <Text style={styles.step}>{t('⑤ TA 长什么样')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={look}
            onChangeText={setLook}
            placeholder={t('银灰色头发，眼下有一颗泪痣，笑起来很凶……')}
            placeholderTextColor={Romance.faint}
            multiline
            maxLength={60}
          />
          <Text style={styles.afterHint}>{t('TA 的主题色——没头像时的底色、界面点缀的颜色：')}</Text>
          <View style={styles.paletteRow}>
            {PALETTES.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => setPalette(i)}
                style={[styles.swatch, { backgroundColor: p.color }, palette === i && styles.swatchActive]}
              />
            ))}
          </View>

          <Text style={styles.step}>{t('⑥ TA 的背景故事')}</Text>
          <TextInput
            style={[styles.input, styles.inputStory]}
            value={story}
            onChangeText={setStory}
            placeholder={t('TA 是谁、从哪里来、身上背着什么故事……')}
            placeholderTextColor={Romance.faint}
            multiline
            maxLength={300}
          />

          <Text style={styles.step}>{t('⑦ TA 的头像（可选）')}</Text>
          <Text style={styles.stepHint}>
            {t('上传一张图，或按 ⑤ 的描述生成一张半身立绘（约 1 分钟）；交友卡面与会话头像都用它。不能上传真人照片。')}
          </Text>
          {portraitUri ? (
            <Image source={{ uri: portraitUri }} style={styles.portrait} contentFit="cover" />
          ) : null}
          <View style={styles.portraitBtnRow}>
            <Pressable style={[styles.secondaryBtn, styles.portraitBtn]} onPress={uploadAvatar}>
              <Text style={styles.secondaryBtnText}>{portraitUri ? t('换一张') : t('上传头像')}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, styles.portraitBtn, (!name.trim() || generating) && styles.btnDisabled]}
              disabled={!name.trim() || generating}
              onPress={genPortrait}>
              {generating ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color={Romance.accent} />
                  <Text style={styles.secondaryBtnText}>{t('生成中…')}</Text>
                </View>
              ) : (
                <Text style={styles.secondaryBtnText}>
                  {imageKeyReady() ? t('生成立绘') : t('生成立绘（AI 不可用）')}
                </Text>
              )}
            </Pressable>
          </View>

          {/* ───────── 高级选项（收起） ───────── */}
          <Pressable style={styles.advToggle} onPress={toggleAdvanced}>
            <Text style={styles.advToggleText}>{advancedOpen ? t('收起高级选项 ▴') : t('高级选项 ▾')}</Text>
            <Text style={styles.advToggleHint}>{t('种族 · 生日 · 口癖 · 恋爱类型 · MBTI · 作息…')}</Text>
          </Pressable>

          {advancedOpen ? (
            <View>
              <Text style={styles.step}>{t('种族')}</Text>
              <View style={styles.chipRow}>
                {[...RACES, '其他'].map((r) => (
                  <Chip key={r} label={r} active={race === r} onPress={() => setRace(r)} />
                ))}
              </View>
              {race === '其他' ? (
                <TextInput
                  style={[styles.input, styles.raceCustomInput]}
                  value={raceCustom}
                  onChangeText={setRaceCustom}
                  placeholder={t('如：半人马')}
                  placeholderTextColor={Romance.faint}
                  maxLength={10}
                />
              ) : null}

              <Text style={styles.step}>{t('TA 的生日')}</Text>
              <View style={styles.chipRow}>
                <Pressable style={styles.ddBtn} onPress={() => setPickerOpen('month')}>
                  <Text style={[styles.ddText, !birthMonth && { color: Romance.faint }]}>
                    {birthMonth ? t('{n} 月', { n: birthMonth }) : t('月份 ▾')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.ddBtn, !birthMonth && styles.btnDisabled]}
                  disabled={!birthMonth}
                  onPress={() => setPickerOpen('day')}>
                  <Text style={[styles.ddText, !birthDay && { color: Romance.faint }]}>
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
              <Text style={styles.afterHint}>{t('会出现在你们的日历上。')}</Text>

              <Text style={styles.step}>{t('口癖')}</Text>
              <Text style={styles.stepHint}>{t('TA 挂在嘴边的话。')}</Text>
              <TextInput
                style={styles.input}
                value={catchphrase}
                onChangeText={setCatchphrase}
                placeholder="「……真拿你没办法」"
                placeholderTextColor={Romance.faint}
                maxLength={20}
              />

              <Text style={styles.step}>{t('喜欢')}</Text>
              <TextInput
                style={styles.input}
                value={likes}
                onChangeText={setLikes}
                placeholder={t('黑咖啡、下雨天、猫……')}
                placeholderTextColor={Romance.faint}
                maxLength={40}
              />

              <Text style={styles.step}>{t('讨厌')}</Text>
              <TextInput
                style={styles.input}
                value={dislikes}
                onChangeText={setDislikes}
                placeholder={t('香菜、迟到、被拍头……')}
                placeholderTextColor={Romance.faint}
                maxLength={40}
              />

              <Text style={styles.step}>{t('确定关系的节奏')}</Text>
              <Text style={styles.stepHint}>{t('TA 陷入心动、想和你确定关系的速度。')}</Text>
              <View style={styles.chipRow}>
                {OFFER_PACES.map((p) => (
                  <Pressable
                    key={p.turns}
                    style={[styles.paceCard, offerTurns === p.turns && styles.paceCardActive]}
                    onPress={() => setOfferTurns(p.turns)}>
                    <Text style={[styles.paceLabel, offerTurns === p.turns && { color: '#fff' }]}>
                      {t(p.label)}
                    </Text>
                    <Text style={[styles.paceHint, offerTurns === p.turns && { color: '#FFE3EC' }]}>
                      {t(p.hint)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.step}>{t('TA 在恋爱中的类型')}</Text>
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

              <Text style={styles.step}>{t('主动联系强度')}</Text>
              <Text style={styles.stepHint}>{t('TA 平时有多主动来找你。')}</Text>
              <View style={styles.chipRow}>
                {INITIATIVES.map((it) => (
                  <Pressable
                    key={it.key}
                    style={[styles.paceCard, initiative === it.key && styles.paceCardActive]}
                    onPress={() => setInitiative(it.key)}>
                    <Text style={[styles.paceLabel, initiative === it.key && { color: '#fff' }]}>
                      {t(it.label)}
                    </Text>
                    <Text style={[styles.paceHint, initiative === it.key && { color: '#FFE3EC' }]}>
                      {t(it.hint)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.step}>{t('预设共同记忆')}</Text>
              <Text style={styles.stepHint}>
                {t('你们「早就认识」的部分：一行一条，TA 会自然提起，初次配对也会像一场重逢。')}
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={presetMemories}
                onChangeText={setPresetMemories}
                placeholder={'高中同桌三年，TA 总抄你的笔记\n去年冬天一起看过一场雪'}
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={200}
              />

              <Text style={styles.step}>{t('禁忌 / 边界')}</Text>
              <Text style={styles.stepHint}>{t('TA 不做的事、回避的话题——涉及时 TA 会温和回避或直接拒绝。')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={taboos}
                onChangeText={setTaboos}
                placeholder="不谈家里的事；不喝酒；被问到左手的疤会岔开话题……"
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={120}
              />

              <Text style={styles.step}>{t('隐藏设定 / 剧情钩子')}</Text>
              <Text style={styles.stepHint}>
                {t('TA 藏着的事：一行一条、浅的在前。羁绊 LV3 起每亲近一级解锁一条；没解锁的 TA 绝不说漏。')}
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={secrets}
                onChangeText={setSecrets}
                placeholder={'其实注册交友软件只是为了找一个人\n左手的疤是替别人挡下来的\n真实身份是……'}
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={300}
              />

              <Text style={styles.step}>{t('其他关于聊天的设定')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={chatNotes}
                onChangeText={setChatNotes}
                placeholder="如：会用一点方言；不主动发语音；叫我「小朋友」……"
                placeholderTextColor={Romance.faint}
                multiline
                maxLength={120}
              />

              <Text style={styles.step}>{t('日常作息')}</Text>
              <Text style={styles.stepHint}>{t('TA 的一天怎么过——决定 TA 什么时候忙、什么时候来找你。')}</Text>
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
            style={[styles.primaryBtn, (!name.trim() || ageStatus === 'minor') && styles.btnDisabled]}
            disabled={!name.trim() || ageStatus === 'minor'}
            onPress={submit}>
            <Text style={styles.primaryBtnText}>
              {ageStatus === 'minor' ? t('未成年角色暂不能发布') : editing ? t('保存修改') : t('让 TA 醒来')}
            </Text>
          </Pressable>
          <Text style={styles.footnote}>{t('不能创造真人与 IP 角色 · 发布即默认同意创作规范')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 生日下拉选单（D-045） */}
      <Modal
        visible={pickerOpen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(null)}>
        <Pressable style={styles.pickerMask} onPress={() => setPickerOpen(null)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>{pickerOpen === 'month' ? t('选择月份') : t('选择日期')}</Text>
            <ScrollView style={styles.pickerList}>
              {(pickerOpen === 'month'
                ? MONTH_OPTIONS
                : Array.from({ length: daysInMonth(birthMonth ?? 1) }, (_, i) => i + 1)
              ).map((n) => {
                const active = (pickerOpen === 'month' ? birthMonth : birthDay) === n;
                return (
                  <Pressable
                    key={n}
                    style={styles.pickerRow}
                    onPress={() => {
                      if (pickerOpen === 'month') {
                        setBirthMonth(n);
                        if (birthDay && birthDay > daysInMonth(n)) setBirthDay(null);
                        setPickerOpen('day');
                      } else {
                        setBirthDay(n);
                        setPickerOpen(null);
                      }
                    }}>
                    <Text style={[styles.pickerRowText, active && styles.pickerRowActive]}>
                      {pickerOpen === 'month' ? t('{n} 月', { n }) : t('{n} 日', { n })}
                    </Text>
                  </Pressable>
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
    afterHint: { fontSize: 11, color: Romance.faint, marginTop: 10, lineHeight: 16 },
    minorNotice: {
      fontSize: 12,
      color: '#B3453C',
      backgroundColor: '#FDEBEA',
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      lineHeight: 18,
    },
    raceCustomInput: { marginTop: 10 },
    ddBtn: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    ddText: { fontSize: 14, color: Romance.ink, fontWeight: '500' },
    ddClear: { justifyContent: 'center', paddingHorizontal: 8 },
    ddClearText: { fontSize: 12, color: Romance.faint },
    pickerMask: {
      flex: 1,
      backgroundColor: 'rgba(59,33,38,0.4)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: Romance.bg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingTop: 18,
      paddingBottom: 30,
      maxHeight: '60%',
    },
    pickerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: Romance.ink,
      textAlign: 'center',
      marginBottom: 8,
    },
    pickerList: { paddingHorizontal: 20 },
    pickerRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Romance.line,
    },
    pickerRowText: { fontSize: 15, color: Romance.ink, textAlign: 'center' },
    pickerRowActive: { color: Romance.accent, fontWeight: '700' },
    portraitBtnRow: { flexDirection: 'row', gap: 10 },
    portraitBtn: { flex: 1 },
    mineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 10,
      marginBottom: 8,
    },
    mineText: { flex: 1 },
    mineName: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    mineSub: { fontSize: 11, color: Romance.faint, marginTop: 1 },
    mineEditBtn: {
      backgroundColor: Romance.accentSoft,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    mineEditText: { fontSize: 12, fontWeight: '700', color: Romance.accent },
    editingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: Romance.accentSoft,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 4,
    },
    editingText: { flex: 1, fontSize: 12, color: Romance.accent, fontWeight: '600' },
    editingCancel: { fontSize: 12, color: Romance.sub },
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
