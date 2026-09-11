/**
 * 世界书 · 编辑 / 查看页（D-110 / D-111；纸面）：新建 / 编辑一个世界——名字、一句话、设定（一行一条）、谁能看到（私密 / 公开）。
 * 公开 = 上传共享世界池（需要登录，未登录回落私密并提示），所有玩家的世界书里都能浏览、收藏；
 * 公开 → 私密 = 从共享池撤下；已绑定的角色带着绑定时的快照，不受之后的更新 / 删除影响（D-112，每次保存版本号自增）。
 * 来自其他玩家的世界只能看、只能收藏，不能改。编辑态可收藏 / 取消收藏、删除（只从世界书里消失，已绑定的角色不动）。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { worldParseSystem } from '@/content/prompts';
import { WORLD_RULES_PLACEHOLDER } from '@/content/worlds';
import { completeText, describeAiError } from '@/lib/engine';
import { uid } from '@/lib/format';
import { getLang, t } from '@/lib/i18n';
import { publishWorld, unpublishWorld } from '@/lib/pool';
import type { WorldBook } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const DESC_MAX = 2000;

type WorldParsed = { name?: string; summary?: string; rules?: string };

/** 规则解析（模型不可用时的回落，D-123）：「维度：内容」的行进设定，第一行没冒号的当名字，其余当一句话 */
function heuristicWorldParse(text: string): WorldParsed {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const grab = (labels: string[]): string | undefined => {
    for (const l of labels) {
      const m = text.match(new RegExp(`${l}\\s*[:：]\\s*([^\\n；;]+)`));
      if (m) return m[1].trim();
    }
    return undefined;
  };
  const ruleLines = lines.filter((l) => /^[^:：]{1,8}[:：]/.test(l) && !/^(名字|名称|世界名|一句话|简介)\s*[:：]/.test(l));
  const name = grab(['世界名', '名字', '名称']) ?? (lines[0] && !/[:：]/.test(lines[0]) && lines[0].length <= 20 ? lines[0] : undefined);
  const summary = grab(['一句话', '简介']) ?? lines.find((l) => l !== name && !/[:：]/.test(l))?.slice(0, 80);
  return { name, summary, rules: ruleLines.length ? ruleLines.join('\n') : undefined };
}

export default function WorldEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const existing = useAppStore((s) => (id ? s.worldBooks.find((w) => w.id === id) : undefined));
  const shared = useAppStore((s) => (id && !existing ? s.sharedWorlds.find((w) => w.id === id) : undefined));
  const fav = useAppStore((s) => (id ? s.worldFavorites.includes(id) : false));
  const [name, setName] = useState(existing?.name ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [rules, setRules] = useState(existing?.rules ?? '');
  const [visibility, setVisibility] = useState<'private' | 'public'>(existing?.visibility ?? 'private');
  const [saving, setSaving] = useState(false);
  // 描述导入（D-123）：一大段世界观 → 模型整理成三项；失败回落规则解析
  const [desc, setDesc] = useState('');
  const [parsing, setParsing] = useState(false);

  const parseDesc = async () => {
    const text = desc.trim();
    if (!text || parsing) return;
    setParsing(true);
    let parsed: WorldParsed | null = null;
    let aiError: string | null = null;
    try {
      const raw = await completeText(worldParseSystem(), text);
      parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as WorldParsed;
    } catch (e) {
      console.warn('[world-edit] 引擎解析失败，回落规则解析：', e);
      aiError = describeAiError(e);
    }
    const r = parsed ?? heuristicWorldParse(text);
    const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
    const pn = str(r.name, 20);
    const ps = str(r.summary, 80);
    const pr = str(r.rules, 1500);
    let n = 0;
    if (pn) {
      setName(pn);
      n++;
    }
    if (ps) {
      setSummary(ps);
      n++;
    }
    if (pr) {
      setRules(pr);
      n++;
    } else if (!parsed) {
      setRules(text.slice(0, 1500));
    }
    setParsing(false);
    const body = n ? t('填好了 {n} 项。往下检查一下，每一项都还能改。', { n }) : t('已把描述放进设定，名字和一句话可以手动补。');
    Alert.alert(
      aiError ? t('模型解析失败，已用规则解析') : n ? t('解析好了') : t('没读出结构化的字段'),
      aiError ? `${body}\n\n${t('原因：{reason}', { reason: aiError })}` : body
    );
  };

  const save = async () => {
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    const now = Date.now();
    let w: WorldBook = existing
      ? { ...existing, name: n, summary: summary.trim(), rules: rules.trim() || undefined, visibility, updatedAt: now }
      : { id: uid('w'), name: n, summary: summary.trim(), rules: rules.trim() || undefined, visibility, lang: getLang(), createdAt: now, updatedAt: now };
    // 公开 = 上传共享池（需要登录）；失败回落私密
    if (w.visibility === 'public') {
      // 上传的是保存后的版本号（store 保存时自增，D-112）
      const ok = await publishWorld(existing ? { ...w, version: (existing.version ?? 1) + 1 } : { ...w, version: 1 });
      if (!ok) {
        w = { ...w, visibility: 'private' };
        Alert.alert(t('先按私密保存了'), t('公开需要登录，登录后可以再改。'));
      }
    }
    // 公开 → 私密：从共享池撤下；已绑定的角色带着快照，不动（D-112）
    if (existing?.visibility === 'public' && w.visibility !== 'public') void unpublishWorld(w.id);
    if (existing) {
      useAppStore.getState().updateWorldBook(w);
    } else {
      useAppStore.getState().addWorldBook(w);
      // 新建即收藏：建出来就是为了给角色用
      useAppStore.getState().toggleWorldFavorite(w.id);
    }
    setSaving(false);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('删除这个世界'), t('「{name}」会从世界书里消失；已经住进去的 TA 带着当时的设定，不受影响。', { name: existing.name }), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('删除'),
        style: 'destructive',
        onPress: () => {
          if (existing.visibility === 'public') void unpublishWorld(existing.id);
          useAppStore.getState().removeWorldBook(existing.id);
          router.back();
        },
      },
    ]);
  };

  // 来自其他玩家的世界：只读 + 收藏
  if (shared) {
    return (
      <AppScreen title={shared.name}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.readName}>{shared.name}</Text>
          <Text style={styles.readSummary}>{shared.summary || t('还没写一句话')}</Text>
          <Text style={styles.readEyebrow}>{t('设定')}</Text>
          <Text style={styles.readRules}>{shared.rules || t('…')}</Text>
          <Text style={styles.readFrom}>{t('来自其他玩家')}</Text>
          <View style={styles.actions}>
            <Button
              label={fav ? t('取消收藏') : t('收藏')}
              variant={fav ? 'paper' : 'primary'}
              size="md"
              onPress={() => useAppStore.getState().toggleWorldFavorite(shared.id)}
            />
          </View>
          <Text style={styles.note}>{t('收藏的世界才会出现在创造角色的选项里。')}</Text>
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={existing ? t('编辑世界') : t('新的世界')}
      right={<HeaderAction label={saving ? t('保存中…') : t('保存')} onPress={() => void save()} disabled={!name.trim() || saving} />}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* ───────── 描述导入（D-123） ───────── */}
          <Field
            label={t('用一段话描述这个世界（可选）')}
            hint={t('小说设定、脑子里的画面、一条条的规则都行，最多 {n} 字。', { n: DESC_MAX })}>
            <Input
              value={desc}
              onChangeText={setDesc}
              placeholder={t('漂浮在云海上的城邦，蒸汽机和契约魔法并存，人人都有一只灵兽，没有手机、靠传信鸟联络……')}
              multiline
              maxLength={DESC_MAX}
              style={styles.desc}
            />
          </Field>
          <View style={styles.descFoot}>
            <Text style={styles.descCount}>
              {desc.length}/{DESC_MAX}
            </Text>
            <View style={styles.btnRow}>
              {parsing ? <ActivityIndicator color={Romance.accent} size="small" /> : null}
              <Button label={parsing ? t('解析中…') : t('自动解析')} size="sm" disabled={!desc.trim() || parsing} onPress={() => void parseDesc()} />
            </View>
          </View>

          <Field label={t('这个世界叫什么')}>
            <Input value={name} onChangeText={setName} placeholder={t('如：云海之上')} maxLength={20} />
          </Field>
          <Field label={t('一句话')}>
            <Input value={summary} onChangeText={setSummary} placeholder={t('这是个什么样的世界')} maxLength={80} />
          </Field>
          <Field label={t('设定')} hint={t('TA 对一切的认知都来自这里：这里有什么、没有什么。')}>
            <Input
              value={rules}
              onChangeText={setRules}
              placeholder={WORLD_RULES_PLACEHOLDER}
              multiline
              style={styles.rules}
              maxLength={1500}
            />
          </Field>
          <Field label={t('谁能看到这个世界')}>
            <View style={styles.chipRow}>
              <Chip label={t('私密')} selected={visibility === 'private'} onPress={() => setVisibility('private')} />
              <Chip label={t('公开')} selected={visibility === 'public'} onPress={() => setVisibility('public')} />
            </View>
          </Field>
          <Text style={styles.hint}>
            {visibility === 'public'
              ? t('公开：所有玩家都能在世界书里看到、收藏它（需要登录）；住在里面的 TA 才能公开。')
              : t('私密：只有你看得见；住在里面的 TA 不能公开。')}
          </Text>
          <Text style={styles.hint}>
            {t('TA 绑定世界的那一刻会带走当时的设定；之后改这里不影响 TA。')}
            {existing ? <Text style={styles.version}> v{existing.version ?? 1}</Text> : null}
          </Text>
          {existing ? (
            <View style={styles.actions}>
              <Button
                label={fav ? t('取消收藏') : t('收藏')}
                variant="paper"
                size="md"
                onPress={() => useAppStore.getState().toggleWorldFavorite(existing.id)}
              />
              <Button label={t('删除')} variant="outline" size="md" onPress={remove} />
            </View>
          ) : null}
          <Text style={styles.note}>{t('收藏的世界才会出现在创造角色的选项里。')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: 18, paddingVertical: Space.screen, paddingBottom: 60, gap: 4 },
    rules: { minHeight: 160, textAlignVertical: 'top' },
    desc: { minHeight: 110, textAlignVertical: 'top' },
    descFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 },
    descCount: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    hint: { fontSize: 12, color: Romance.sub, lineHeight: 18, marginTop: 4 },
    version: { fontFamily: Fonts.label, color: Romance.faint },
    actions: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: 12 },
    note: { textAlign: 'center', color: Romance.faint, fontSize: 11, marginTop: 16 },
    readName: { fontSize: 20, fontWeight: '600', color: Romance.ink },
    readSummary: { fontSize: 14, lineHeight: 21, color: Romance.sub, marginTop: 4 },
    readEyebrow: { fontSize: 12, fontWeight: '500', color: Romance.sub, letterSpacing: 0.5, marginTop: 16 },
    readRules: { fontSize: 14, lineHeight: 22, color: Romance.ink, marginTop: 4 },
    readFrom: { fontSize: 11, color: Romance.faint, marginTop: 12 },
  })
);
