/**
 * 传记编辑器（D-149）：创造表单「传记」页签——创作者按章写 TA 的故事。
 * 章节列表（标题 / 开放阶段 / 段数，可上移下移删除）→ 点开一章原地编辑：标题、开放阶段（LV1–6 chip）、
 * 正文块（文字段落 / 图片：上传含 gif、现场生图走 generateScenePhoto 与流量闸门）。
 * 只改传进来的 chapters、通过 onChange 回给表单，不碰 store——随表单一起保存。
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { showToast } from '@/components/toast';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { LEVEL_NAMES } from '@/lib/bond';
import { describeAiError } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { generateScenePhoto, imageKeyReady } from '@/lib/imagegen';
import type { Character, StoryBlock, StoryChapter } from '@/lib/types';

const TITLE_MAX = 30;
const TEXT_MAX = 2000;
const CAPTION_MAX = 60;
const PROMPT_MAX = 200;

export function newChapter(index: number): StoryChapter {
  const now = Date.now();
  return { id: uid('ch'), title: t('第 {n} 章', { n: index + 1 }), blocks: [{ type: 'text', text: '' }], unlockLevel: 1, createdAt: now, updatedAt: now };
}

export function StoryEditor({
  chapters,
  onChange,
  character,
}: {
  chapters: StoryChapter[];
  onChange: (next: StoryChapter[]) => void;
  /** 生图跟角色画风走；还没起名的草稿传 null */
  character: Pick<Character, 'artStyle'> | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const patch = (id: string, fn: (c: StoryChapter) => StoryChapter) =>
    onChange(chapters.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)));

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const remove = (c: StoryChapter) => {
    Alert.alert(t('删除这一章？'), c.title, [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('删除'),
        style: 'destructive',
        onPress: () => {
          onChange(chapters.filter((x) => x.id !== c.id));
          if (openId === c.id) setOpenId(null);
        },
      },
    ]);
  };

  const add = () => {
    const c = newChapter(chapters.length);
    onChange([...chapters, c]);
    setOpenId(c.id);
  };

  return (
    <View>
      <Text style={styles.sectionHint}>{t('TA 从哪来、TA 是谁——按章写，每章定一个开放的阶段。')}</Text>
      {chapters.length === 0 ? <Text style={styles.empty}>{t('还没有章节')}</Text> : null}
      {chapters.map((c, i) =>
        openId === c.id ? (
          <ChapterEditor
            key={c.id}
            chapter={c}
            character={character}
            onPatch={(fn) => patch(c.id, fn)}
            onDone={() => setOpenId(null)}
          />
        ) : (
          <Card key={c.id} style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => setOpenId(c.id)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {c.title.trim() || t('未命名')}
              </Text>
              <View style={styles.rowMeta}>
                <Text style={styles.lvTag}>LV{c.unlockLevel}</Text>
                <Text style={styles.rowSub}>{t('{n} 段', { n: c.blocks.length })}</Text>
              </View>
            </Pressable>
            <View style={styles.rowActions}>
              <Pressable hitSlop={6} disabled={i === 0} onPress={() => move(i, -1)}>
                <Text style={[styles.action, i === 0 && styles.actionOff]}>{t('上移')}</Text>
              </Pressable>
              <Pressable hitSlop={6} disabled={i === chapters.length - 1} onPress={() => move(i, 1)}>
                <Text style={[styles.action, i === chapters.length - 1 && styles.actionOff]}>{t('下移')}</Text>
              </Pressable>
              <Pressable hitSlop={6} onPress={() => remove(c)}>
                <Text style={[styles.action, styles.actionDanger]}>{t('删除')}</Text>
              </Pressable>
            </View>
          </Card>
        )
      )}
      <Button label={t('新的一章')} variant="outline" size="md" style={styles.addBtn} onPress={add} />
    </View>
  );
}

function ChapterEditor({
  chapter,
  character,
  onPatch,
  onDone,
}: {
  chapter: StoryChapter;
  character: Pick<Character, 'artStyle'> | null;
  onPatch: (fn: (c: StoryChapter) => StoryChapter) => void;
  onDone: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);

  const setBlocks = (fn: (b: StoryBlock[]) => StoryBlock[]) => onPatch((c) => ({ ...c, blocks: fn(c.blocks) }));
  const setBlock = (i: number, b: StoryBlock) => setBlocks((bs) => bs.map((x, k) => (k === i ? b : x)));
  const removeBlock = (i: number) => setBlocks((bs) => bs.filter((_, k) => k !== i));

  /** 上传：相册里的图与 gif（红线 #1：不收真人照片，试装为自我声明） */
  const upload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const uri = result.canceled ? undefined : result.assets[0]?.uri;
    if (uri) setBlocks((bs) => [...bs, { type: 'image', uri }]);
  };

  /** 现场生图：按角色画风，走流量闸门与用量记账（lib/imagegen） */
  const draw = async () => {
    const p = prompt.trim();
    if (!p || drawing) return;
    if (!imageKeyReady()) {
      showToast(t('AI 不可用'));
      return;
    }
    setDrawing(true);
    try {
      const uri = await generateScenePhoto(p, character ?? undefined);
      setBlocks((bs) => [...bs, { type: 'image', uri, caption: p.slice(0, CAPTION_MAX) }]);
      setPrompt('');
      setDrawOpen(false);
    } catch (e) {
      console.warn('[story] 生图失败：', e);
      showToast(t('没画出来：{reason}', { reason: describeAiError(e) }));
    } finally {
      setDrawing(false);
    }
  };

  return (
    <Card style={styles.editor}>
      <Field label={t('标题')}>
        <Input value={chapter.title} onChangeText={(v) => onPatch((c) => ({ ...c, title: v }))} maxLength={TITLE_MAX} />
      </Field>
      <Field label={t('开放阶段')}>
        <View style={styles.chipRow}>
          {LEVEL_NAMES.map((name, i) => (
            <Chip
              key={name}
              label={`LV${i + 1} · ${t(name)}`}
              selected={chapter.unlockLevel === i + 1}
              onPress={() => onPatch((c) => ({ ...c, unlockLevel: i + 1 }))}
            />
          ))}
        </View>
      </Field>

      {chapter.blocks.map((b, i) => (
        <View key={i} style={styles.block}>
          {b.type === 'text' ? (
            <Input
              value={b.text}
              onChangeText={(v) => setBlock(i, { type: 'text', text: v })}
              placeholder={t('写下这一段……')}
              multiline
              maxLength={TEXT_MAX}
            />
          ) : (
            <View>
              <Image source={{ uri: b.uri }} style={styles.image} contentFit="cover" />
              <Input
                value={b.caption ?? ''}
                onChangeText={(v) => setBlock(i, { ...b, caption: v })}
                placeholder={t('图片说明（可不填）')}
                maxLength={CAPTION_MAX}
                style={styles.caption}
              />
            </View>
          )}
          <Pressable hitSlop={6} style={styles.blockRemove} onPress={() => removeBlock(i)}>
            <Text style={[styles.action, styles.actionDanger]}>{t('删除')}</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <Button label={t('加一段文字')} variant="secondary" size="sm" onPress={() => setBlocks((bs) => [...bs, { type: 'text', text: '' }])} />
        <Button label={t('上传图片')} variant="secondary" size="sm" onPress={upload} />
        <Button label={t('生图')} variant="secondary" size="sm" onPress={() => setDrawOpen((v) => !v)} />
      </View>
      {drawOpen ? (
        <View style={styles.drawBox}>
          <Input value={prompt} onChangeText={setPrompt} placeholder={t('想画什么……')} multiline maxLength={PROMPT_MAX} />
          <View style={styles.drawFoot}>
            {drawing ? <ActivityIndicator color={Romance.accent} size="small" /> : null}
            <Button label={drawing ? t('生成中…') : t('画一张')} size="sm" disabled={!prompt.trim() || drawing} onPress={draw} />
          </View>
        </View>
      ) : null}

      <Button label={t('完成')} variant="outline" size="md" style={styles.doneBtn} onPress={onDone} />
    </Card>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sectionHint: { fontSize: 12, color: Romance.sub, marginTop: Space.inlineLoose, lineHeight: 17 },
    empty: { fontSize: 13, color: Romance.sub, textAlign: 'center', marginTop: 28 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, marginTop: Space.inlineLoose },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, marginTop: 4 },
    lvTag: {
      fontFamily: Fonts.labelBold,
      fontSize: 11,
      color: Romance.accentStrong,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    rowSub: { fontSize: 12, color: Romance.sub },
    rowActions: { gap: 6, alignItems: 'flex-end' },
    action: { fontSize: 12, fontWeight: '500', color: Romance.accent },
    actionOff: { opacity: 0.3 },
    actionDanger: { color: Romance.danger },
    addBtn: { marginTop: Space.cardX },
    editor: { marginTop: Space.inlineLoose },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    block: { marginTop: Space.inlineLoose },
    image: { width: '100%', aspectRatio: 4 / 3, borderRadius: Shape.radius, backgroundColor: Romance.line },
    caption: { marginTop: Space.inline },
    blockRemove: { alignSelf: 'flex-end', marginTop: 4 },
    addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline, marginTop: Space.cardX },
    drawBox: { marginTop: Space.inlineLoose },
    drawFoot: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Space.inline, marginTop: Space.inline },
    doneBtn: { marginTop: Space.cardX },
  })
);
