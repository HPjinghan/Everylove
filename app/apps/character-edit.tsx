/**
 * 编辑已创建的 TA（D-050 / D-095；D-149 页签；D-260 只管编辑——新建是 app/apps/character-new.tsx 的分步捏人）：
 * 创造列表行「编辑」带 edit=<id> 进来，全部字段回填。没带 id / 找不到就去新建。
 * 五个页签：基础（名字 / 性别 / 背景 / 恋爱类型 / 声音 / 谁能遇到）· 形象（立绘 / 画风 / 长相 / 主题色）·
 * 细节（其余设定）· 台词（开场 / 想做朋友 / 成为朋友后 / 人设 / 追法，可让 TA 重写）· 传记（按章写、每章设开放阶段）。
 * 底部只留一颗「保存修改」；换页签不丢输入（全部状态在一份表单里）。
 * 字段组在 components/character-fields.tsx，表单模型在 lib/character-form.ts。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
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
import { Segmented } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { StoryEditor } from '@/components/story-editor';
import { showToast } from '@/components/toast';
import { VoicePicker } from '@/components/voice-picker';
import { Space } from '@/constants/design';
import { themed } from '@/constants/theme';
import { blocked, characterFromForm, formFor, GENDERS, type CharacterForm } from '@/lib/character-form';
import { generateCharacterLines } from '@/lib/character-lines';
import { getLang, t } from '@/lib/i18n';
import { unpublishCharacter } from '@/lib/pool';
import { VOICE_SAMPLE_LINE } from '@/lib/speech';
import type { Character, CharacterLines } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

type Tab = 'basic' | 'look' | 'settings' | 'lines' | 'story';
const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '基础' },
  { key: 'look', label: '形象' },
  { key: 'settings', label: '细节' },
  { key: 'lines', label: '台词' },
  { key: 'story', label: '传记' },
];

/** 保存后的冷却（D-121）：这段时间里再点不响应 */
const SUBMIT_COOLDOWN_MS = 1000;

const EMPTY_LINES: CharacterLines = { opening: [], offer: [], arrival: [] };

/** 一组台词：一行一条（D-094） */
function LinesField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label={label}>
      <Input value={value.join('\n')} onChangeText={(text) => onChange(text.split('\n'))} placeholder={placeholder} multiline maxLength={400} />
    </Field>
  );
}

export default function CharacterEditScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const character = useAppStore((s) => s.customCharacters.find((c) => c.id === edit && !c.shared));
  if (!character) return <Redirect href={'/apps/character-new' as never} />;
  // 换一个 edit 就整表重挂载，初始值按它算
  return <EditForm key={character.id} character={character} />;
}

function EditForm({ character }: { character: Character }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<CharacterForm>(() => formFor(character, useAppStore.getState().portraits[character.id]));
  const patch: Patch = (p) => setForm((f) => ({ ...f, ...p }));
  const [tab, setTab] = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [linesBusy, setLinesBusy] = useState(false);
  // 提交去重（D-121）：ref 同步上锁，进行中与结束后 1 秒内的再次调用直接返回
  const submitLock = useRef(0);
  const lines = form.lines;
  const setLines = (l: CharacterLines) => patch({ lines: l });

  /** 保存（D-050）：原位更新，不动热度与羁绊；公开 → 私密从共享池撤下（D-060） */
  const save = async () => {
    const now = Date.now();
    if (submitLock.current === -1 || now - submitLock.current < SUBMIT_COOLDOWN_MS) return;
    if (blocked(form)) {
      alertBlocked();
      return;
    }
    let next = characterFromForm(form, { id: character.id, adoptedCount: character.adoptedCount });
    if (!next) return;
    submitLock.current = -1;
    setSaving(true);
    try {
      next = await publishIfPublic(next);
      if (character.visibility === 'public' && next.visibility !== 'public') void unpublishCharacter(character.id);
      useAppStore.getState().updateCustomCharacter(next);
      if (form.portraitUri) useAppStore.getState().setPortrait(character.id, form.portraitUri);
      showToast(t('已保存'));
      router.back();
    } finally {
      submitLock.current = Date.now();
      setSaving(false);
    }
  };

  /** 让 TA 按当前表单重写一遍台词（D-094）；写不成保留原来的 */
  const rewriteLines = async () => {
    const draft = characterFromForm(form, { id: character.id, lines: null });
    if (!draft || linesBusy) return;
    setLinesBusy(true);
    const written = await generateCharacterLines(draft);
    setLinesBusy(false);
    if (written) setLines(written);
    else showToast(t('没写成，先保留原来的'));
  };

  return (
    <AppScreen title={character.name}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.tabs}>
          <Segmented options={TABS.map((x) => ({ key: x.key, label: t(x.label) }))} value={tab} onChange={setTab} />
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'basic' ? (
            <View>
              <IdentityFields form={form} patch={patch} />
              <LoveStylePicker value={form.loveStyle} onChange={(loveStyle) => patch({ loveStyle })} />
              {/* 声音放在恋爱类型下面：不选就跟着恋爱类型走（D-250） */}
              <VoicePicker
                lang={getLang()}
                gender={form.gender}
                loveStyle={form.loveStyle}
                value={form.voiceId}
                onChange={(voiceId) => patch({ voiceId })}
                sampleText={lines?.opening?.[0] ?? t(VOICE_SAMPLE_LINE)}
                pronoun={GENDERS.find((x) => x.key === form.gender)!.pronoun}
              />
              <VisibilityField form={form} patch={patch} />
            </View>
          ) : null}

          {tab === 'look' ? <LookFields form={form} patch={patch} /> : null}

          {tab === 'settings' ? <DetailFields form={form} patch={patch} /> : null}

          {/* TA 的台词（D-094）：醒来时模型写好一份，这里可逐条改、可让 TA 重写 */}
          {tab === 'lines' ? (
            <View>
              <LinesField
                label={t('开场白')}
                placeholder={t('你也还没睡？\n刚好，我也在想要不要先开口')}
                value={lines?.opening ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), opening: v })}
              />
              <LinesField
                label={t('想做朋友时')}
                placeholder={t('……下次还能找你聊吗')}
                value={lines?.offer ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), offer: v })}
              />
              <LinesField
                label={t('成为朋友后的第一句')}
                placeholder={t('是我。号码存好了吗')}
                value={lines?.arrival ?? []}
                onChange={(v) => setLines({ ...(lines ?? EMPTY_LINES), arrival: v })}
              />
              <Field label={t('一句话人设')}>
                <Input
                  value={lines?.persona ?? ''}
                  onChangeText={(v) => setLines({ ...(lines ?? EMPTY_LINES), persona: v })}
                  placeholder={t('嘴硬心软的外科医生，只为你破例')}
                  multiline
                  maxLength={120}
                />
              </Field>
              <Field label={t('追法')}>
                <Input
                  value={lines?.pursuit ?? ''}
                  onChangeText={(v) => setLines({ ...(lines ?? EMPTY_LINES), pursuit: v })}
                  placeholder={t('先嫌弃、再靠近，关心全藏在吐槽里')}
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
                onPress={() => void rewriteLines()}
              />
            </View>
          ) : null}

          {/* 传记（D-149）：按章写、每章设开放阶段；随角色一起保存 */}
          {tab === 'story' ? <StoryEditor chapters={form.chapters} onChange={(chapters) => patch({ chapters })} character={{ artStyle: form.artStyle }} /> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Space.screen) }]}>
          <Button
            label={saving ? t('保存中…') : t('保存修改')}
            disabled={!form.name.trim() || !form.portraitUri || saving}
            onPress={() => void save()}
          />
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    // 表单类页面左右留白按设计稿 18
    content: { paddingHorizontal: 18, paddingBottom: 24 },
    tabs: { paddingHorizontal: 18, paddingTop: Space.inlineLoose },
    rewriteBtn: { marginTop: Space.cardX },
    footer: { paddingHorizontal: 18, paddingTop: Space.inline },
  })
);
