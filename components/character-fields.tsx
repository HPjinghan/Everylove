/**
 * 捏人的字段组（D-260）：分步新建与编辑共用，每组只吃一份表单（lib/character-form.ts）和一个 patch。
 * - IdentityFields：名字 / 性别 / 背景故事
 * - LoveStylePicker：恋爱类型卡片——名字 + 这种人会说的一句话 + 一句追法（必选，决定 TA 怎么说话、怎么走近）
 * - LookFields：长相 / 主题色 / 画风 / 立绘（上传或生成，不收真人照片）
 * - DetailFields：其余细节（种族、生日、口癖、喜好、节奏、MBTI、主动、说话节奏、共同记忆、禁忌、隐藏设定、聊天设定、作息）
 * - VisibilityField：私密 / 公开（公开进共享池，D-060）
 * - publishIfPublic：公开的上传共享池；没登录 / 失败按私密存并说一声
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { showAlert } from '@/components/action-sheet';
import { alertAiUnavailable } from '@/components/ai-unavailable';
import { BirthdayPicker } from '@/components/birthday-picker';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DevelopingFilm, useStepLine } from '@/components/developing';
import { Field, Input } from '@/components/input';
import { Shape, Space, Type } from '@/constants/design';
import { Romance, themed, withAlpha } from '@/constants/theme';
import { LOVE_STYLES, RACES } from '@/content/characters';
import { PORTRAIT_STYLES } from '@/content/prompts';
import {
  BUBBLE_STYLES,
  characterFromForm,
  blocked,
  GENDERS,
  INITIATIVES,
  MBTI_LIST,
  OFFER_PACES,
  PALETTES,
  type CharacterForm,
} from '@/lib/character-form';
import { describeAiError } from '@/lib/chat';
import { t } from '@/lib/i18n';
import { generatePortraitFor, imageKeyReady } from '@/lib/imagegen';
import { copyIntoDocuments } from '@/lib/media-paths';
import { publishCharacter } from '@/lib/pool';
import type { Character } from '@/lib/types';

export type Patch = (p: Partial<CharacterForm>) => void;

/** 红线拦截的那句（真人明星 / 已有 IP） */
export function alertBlocked(): void {
  showAlert(t('这个 TA 不能被创造出来'), t('不能创造真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。'));
}

/** 公开角色上传共享池（D-060）；没登录 / 失败回落私密并说一声 */
export async function publishIfPublic(character: Character): Promise<Character> {
  if (character.visibility !== 'public') return character;
  if (await publishCharacter(character)) return character;
  showAlert(t('先按私密保存了'), t('公开需要登录，登录后可以再改。'));
  return { ...character, visibility: 'private' };
}

function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Chip label={t(label)} selected={active} onPress={onPress} />;
}

/** 单选 chip 组（D-198）：memo——表单别的字段每次击键不再重画 16 个 MBTI */
const ChipGroup = memo(function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <OptionChip key={o} label={o} active={value === o} onPress={() => onChange(value === o ? undefined : o)} />
      ))}
    </View>
  );
});

/** 三选一的小卡（节奏 / 主动强度 / 说话节奏）：白底，选中强调色白字 */
function PaceCard({ label, hint, active, onPress }: { label: string; hint: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.paceCard, active && styles.paceCardOn]} onPress={onPress}>
      <Text style={[styles.paceLabel, active && styles.paceLabelOn]}>{t(label)}</Text>
      <Text style={[styles.paceHint, active && styles.paceHintOn]}>{t(hint)}</Text>
    </Pressable>
  );
}

export function IdentityFields({ form, patch }: { form: CharacterForm; patch: Patch }) {
  return (
    <View>
      <Field label={t('TA 叫什么')}>
        <Input value={form.name} onChangeText={(name) => patch({ name })} placeholder={t('给 TA 一个名字')} maxLength={12} />
      </Field>
      <Field label={t('TA 的性别')}>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => (
            <OptionChip key={g.key} label={g.label} active={form.gender === g.key} onPress={() => patch({ gender: g.key })} />
          ))}
        </View>
      </Field>
      <Field label={t('TA 的背景故事')}>
        <Input
          value={form.story}
          onChangeText={(story) => patch({ story })}
          placeholder={t('TA 是谁、从哪里来、身上背着什么故事……')}
          multiline
          maxLength={300}
        />
      </Field>
    </View>
  );
}

/** 恋爱类型卡片（D-260）：一张一种人——名字、这种人会说的一句话、追法 */
export const LoveStylePicker = memo(function LoveStylePicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (label: string) => void;
}) {
  return (
    <Field label={t('TA 在恋爱中的类型')}>
      <View style={styles.styleList}>
        {LOVE_STYLES.map((s) => {
          const on = value === s.label;
          return (
            <Pressable
              key={s.label}
              onPress={() => onChange(s.label)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.styleCard, on && styles.styleCardOn]}>
              <Text style={[styles.styleName, on && styles.styleNameOn]}>{t(s.label)}</Text>
              <Text style={styles.styleSample}>{t('「{x}」', { x: t(s.sample) })}</Text>
              <Text style={styles.styleDesc} numberOfLines={on ? undefined : 1}>
                {t(s.desc)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
});

/** 立绘出图中（D-209）：立绘位上一块正在显影的底，下面一行字一句一句往下走 */
const PORTRAIT_LINES = ['在描轮廓…', '在上色…', '在调光线…', '快好了…'];
function PortraitDeveloping({ size }: { size: number }) {
  const line = useStepLine(PORTRAIT_LINES, 12_000);
  return (
    <View style={styles.portraitWait}>
      <DevelopingFilm width={size} style={styles.portraitFilm} />
      <Text style={styles.afterHint}>{t(line)}</Text>
    </View>
  );
}

export function LookFields({ form, patch, portraitSize = 180 }: { form: CharacterForm; patch: Patch; portraitSize?: number }) {
  const [generating, setGenerating] = useState(false);

  /** 上传（D-045）：相册选图；红线 #1——不收真人照片（自我声明，真人检测见 OPEN_QUESTIONS #14） */
  const upload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [3, 4] });
    // 相册给的是缓存路径（D-203）：拷进 App 自己的目录再当立绘
    if (!result.canceled && result.assets[0]?.uri) patch({ portraitUri: await copyIntoDocuments(result.assets[0].uri, 'portraits') });
  };

  const generate = async () => {
    const draft = characterFromForm(form, { id: 'draft' });
    if (!draft || generating) return;
    if (!imageKeyReady()) {
      alertAiUnavailable();
      return;
    }
    if (blocked(form)) {
      alertBlocked();
      return;
    }
    setGenerating(true);
    try {
      patch({ portraitUri: await generatePortraitFor(draft) });
    } catch (e) {
      console.warn('[create] 立绘生成失败：', e);
      // 形象必选、没有「跳过」这条路；原因只在开发构建露出
      showAlert(
        t('立绘没画出来'),
        __DEV__ ? `${t('生图服务出了点问题，可以再试一次。')}\n\n${t('原因：{reason}', { reason: describeAiError(e) })}` : t('生图服务出了点问题，可以再试一次。')
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View>
      <View style={styles.portraitBox}>
        {generating ? (
          <PortraitDeveloping size={portraitSize} />
        ) : form.portraitUri ? (
          <Image source={{ uri: form.portraitUri }} style={[styles.portrait, { width: portraitSize, height: (portraitSize * 4) / 3 }]} contentFit="cover" />
        ) : (
          <View style={[styles.portraitEmpty, { width: portraitSize, height: (portraitSize * 4) / 3 }]} />
        )}
      </View>
      <View style={styles.portraitBtnRow}>
        <Button label={form.portraitUri ? t('换一张') : t('上传图片')} variant="secondary" size="md" style={styles.flex} onPress={() => void upload()} />
        <Button
          label={generating ? t('生成中…') : t('生成立绘')}
          variant="outline"
          size="md"
          style={styles.flex}
          disabled={!form.name.trim() || generating}
          onPress={() => void generate()}
        />
      </View>
      <Text style={styles.afterHint}>{t('不能上传真人照片。')}</Text>

      <Field label={t('画风')}>
        <View style={styles.chipRow}>
          {PORTRAIT_STYLES.map((s) => (
            <OptionChip key={s.id} label={s.label} active={form.artStyle === s.id} onPress={() => patch({ artStyle: s.id })} />
          ))}
        </View>
      </Field>

      <Field label={t('TA 长什么样')}>
        <Input
          value={form.look}
          onChangeText={(look) => patch({ look })}
          placeholder={t('银灰色头发，眼下有一颗泪痣，笑起来很凶……')}
          multiline
          maxLength={60}
          style={styles.inputShort}
        />
      </Field>

      <Field label={t('TA 的主题色')}>
        <View style={styles.paletteRow}>
          {PALETTES.map((p, i) => (
            <Pressable
              key={p.color}
              onPress={() => patch({ palette: i })}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: form.palette === i }}
              style={[styles.swatchRing, form.palette === i && styles.swatchRingOn]}>
              <View style={[styles.swatch, { backgroundColor: p.color }]} />
            </Pressable>
          ))}
        </View>
      </Field>
    </View>
  );
}

export function DetailFields({ form, patch }: { form: CharacterForm; patch: Patch }) {
  return (
    <View>
      <Field label={t('种族')}>
        <View style={styles.chipRow}>
          {[...RACES, '其他'].map((r) => (
            <OptionChip key={r} label={r} active={form.race === r} onPress={() => patch({ race: r })} />
          ))}
        </View>
        {form.race === '其他' ? (
          <Input
            style={styles.raceCustomInput}
            value={form.raceCustom}
            onChangeText={(raceCustom) => patch({ raceCustom })}
            placeholder={t('如：半人马')}
            maxLength={10}
          />
        ) : null}
      </Field>

      <Field label={t('TA 的生日')}>
        <BirthdayPicker value={form.birthday} onChange={(birthday) => patch({ birthday })} />
      </Field>

      <Field label={t('口癖')}>
        <Input value={form.catchphrase} onChangeText={(catchphrase) => patch({ catchphrase })} placeholder={t('「……真拿你没办法」')} maxLength={20} />
      </Field>
      <Field label={t('喜欢')}>
        <Input value={form.likes} onChangeText={(likes) => patch({ likes })} placeholder={t('黑咖啡、下雨天、猫……')} maxLength={40} />
      </Field>
      <Field label={t('讨厌')}>
        <Input value={form.dislikes} onChangeText={(dislikes) => patch({ dislikes })} placeholder={t('香菜、迟到、被拍头……')} maxLength={40} />
      </Field>

      <Field label={t('走近的节奏')}>
        <View style={styles.chipRow}>
          {OFFER_PACES.map((p) => (
            <PaceCard key={p.turns} label={p.label} hint={p.hint} active={form.offerTurns === p.turns} onPress={() => patch({ offerTurns: p.turns })} />
          ))}
        </View>
      </Field>

      <Field label="MBTI">
        <ChipGroup options={MBTI_LIST} value={form.mbti} onChange={(mbti) => patch({ mbti })} />
      </Field>

      <Field label={t('主动联系强度')}>
        <View style={styles.chipRow}>
          {INITIATIVES.map((it) => (
            <PaceCard key={it.key} label={it.label} hint={it.hint} active={form.initiative === it.key} onPress={() => patch({ initiative: it.key })} />
          ))}
        </View>
      </Field>

      <Field label={t('说话节奏')}>
        <View style={styles.chipRow}>
          {BUBBLE_STYLES.map((it) => (
            <PaceCard key={it.label} label={it.label} hint={it.hint} active={form.bubbleStyle === it.key} onPress={() => patch({ bubbleStyle: it.key })} />
          ))}
        </View>
      </Field>

      <Field label={t('预设共同记忆')} hint={t('你们「早就认识」的部分。')}>
        <Input
          value={form.presetMemories}
          onChangeText={(presetMemories) => patch({ presetMemories })}
          placeholder={t('高中同桌三年，TA 总抄你的笔记\n去年冬天一起看过一场雪')}
          multiline
          maxLength={200}
        />
      </Field>
      <Field label={t('禁忌 / 边界')}>
        <Input
          value={form.taboos}
          onChangeText={(taboos) => patch({ taboos })}
          placeholder={t('不谈家里的事；不喝酒；被问到左手的疤会岔开话题……')}
          multiline
          maxLength={120}
        />
      </Field>
      <Field label={t('隐藏设定 / 剧情钩子')} hint={t('TA 藏着的事，浅的在前。')}>
        <Input
          value={form.secrets}
          onChangeText={(secrets) => patch({ secrets })}
          placeholder={t('其实注册交友软件只是为了找一个人\n左手的疤是替别人挡下来的\n真实身份是……')}
          multiline
          maxLength={300}
        />
      </Field>
      <Field label={t('其他关于聊天的设定')}>
        <Input
          value={form.chatNotes}
          onChangeText={(chatNotes) => patch({ chatNotes })}
          placeholder={t('如：会用一点方言；叫我「小朋友」……')}
          multiline
          maxLength={120}
        />
      </Field>
      <Field label={t('日常作息')}>
        <Input
          value={form.schedule}
          onChangeText={(schedule) => patch({ schedule })}
          placeholder={t('早八晚六上班，周三晚上健身，习惯凌晨一点睡……')}
          multiline
          maxLength={120}
        />
      </Field>
    </View>
  );
}

export function VisibilityField({ form, patch }: { form: CharacterForm; patch: Patch }) {
  return (
    <View>
      <Field label={t('谁能遇到 TA')}>
        <View style={styles.chipRow}>
          <OptionChip label="私密" active={form.visibility === 'private'} onPress={() => patch({ visibility: 'private' })} />
          <OptionChip label="公开" active={form.visibility === 'public'} onPress={() => patch({ visibility: 'public' })} />
        </View>
      </Field>
      {form.visibility === 'public' ? <Text style={styles.afterHint}>{t('公开：其他人也能遇到 TA（需要登录）。')}</Text> : null}
    </View>
  );
}

/** 主题色块选中外圈：墨色 2.5、留 2 */
const SWATCH_RING = { width: 2.5, gap: 2 };

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    inputShort: { minHeight: 64 },
    afterHint: { fontSize: Type.scale.timestamp.size, color: Romance.sub, marginTop: Space.inline, lineHeight: 16 },
    raceCustomInput: { marginTop: Space.inlineLoose },
    // 恋爱类型卡片：白卡，选中强调色描边 + 浅底
    styleList: { gap: Space.inline },
    styleCard: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      borderWidth: Shape.border,
      borderColor: 'transparent',
      paddingVertical: Space.cardY,
      paddingHorizontal: Space.cardX,
    },
    styleCardOn: { borderColor: Romance.accent, backgroundColor: Romance.accentSoft },
    styleName: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    styleNameOn: { color: Romance.accentStrong },
    styleSample: { fontSize: Type.scale.sub.size, color: Romance.ink, marginTop: 4 },
    styleDesc: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 4, lineHeight: 17 },
    portraitBox: { alignItems: 'center', marginTop: Space.inlineLoose },
    portrait: { borderRadius: Shape.radius },
    portraitEmpty: { borderRadius: Shape.radius, backgroundColor: Romance.line },
    portraitWait: { alignItems: 'center', gap: 6 },
    portraitFilm: { borderRadius: Shape.radius },
    portraitBtnRow: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: Space.inlineLoose },
    paletteRow: { flexDirection: 'row', gap: Space.inline },
    swatchRing: {
      borderWidth: SWATCH_RING.width,
      borderColor: 'transparent',
      padding: SWATCH_RING.gap,
      borderRadius: Shape.radius + SWATCH_RING.gap + SWATCH_RING.width,
    },
    swatchRingOn: { borderColor: Romance.ink },
    swatch: { width: 32, height: 32, borderRadius: Shape.radius },
    paceCard: {
      flex: 1,
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingVertical: Space.cardX,
      paddingHorizontal: Space.cardY,
      alignItems: 'center',
    },
    paceCardOn: { backgroundColor: Romance.accent },
    paceLabel: { fontSize: Type.scale.sub.size, fontWeight: '600', color: Romance.ink },
    paceLabelOn: { color: '#FFFFFF' },
    paceHint: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 3 },
    paceHintOn: { color: withAlpha('#FFFFFF', 0.8) },
  })
);
