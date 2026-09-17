/**
 * 音色选择（D-139，创造 ⑧）：按角色的语言 × 性别 × 气质从音色池推荐三把，每把可试听一句（Fish 合成、走 tts 缓存）；
 * 「换一批」再推三把，池子转完循环。音色池里没有这门语言的声线时整块不显示（无供给不摆入口）。
 * 纸面：Chip 选中 = primary；试听键 ink 图标。
 */

import { useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import type { VoiceOption } from '@/content/voices';
import type { Lang } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { recommendVoices, voicesFor } from '@/lib/speech';
import { previewVoice } from '@/lib/tts';

export function VoicePicker({
  lang,
  gender,
  hints,
  value,
  onChange,
  sampleText,
  pronoun,
}: {
  lang: Lang;
  gender: VoiceOption['gender'];
  /** 推荐打分用的提示词（恋爱类型 / 种族 / 风格标签） */
  hints: (string | undefined)[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** 试听念的那句（开场白优先） */
  sampleText: string;
  pronoun: '他' | '她' | 'TA';
}) {
  const [round, setRound] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);

  if (voicesFor(lang).length === 0) return null;
  const picks = recommendVoices({ lang, gender, hints: hints.filter((h): h is string => Boolean(h)) }, round);
  // 已选的不在这一批里也要露出来（编辑回填 / 换过批）
  const selected = value && !picks.some((v) => v.id === value) ? voicesFor(lang).find((v) => v.id === value) : undefined;
  const shown = selected ? [selected, ...picks] : picks;

  const listen = async (v: VoiceOption) => {
    if (busyId) return;
    if (playingId === v.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    setBusyId(v.id);
    const uri = await previewVoice(sampleText, v.id, pronoun);
    setBusyId(null);
    if (!uri) return;
    player.replace({ uri });
    player.seekTo(0);
    player.play();
    setPlayingId(v.id);
    setTimeout(() => setPlayingId((cur) => (cur === v.id ? null : cur)), 8000);
  };

  return (
    <Field label={t('⑧ TA 的声音')}>
      <View style={styles.rows}>
        {shown.map((v) => (
          <View key={v.id} style={styles.row}>
            <Chip label={v.name} selected={value === v.id} onPress={() => onChange(value === v.id ? undefined : v.id)} style={styles.chip} />
            <Text style={styles.tags} numberOfLines={1}>
              {v.tags.slice(0, 3).map((tg) => t(tg)).join(' · ')}
            </Text>
            <Pressable onPress={() => void listen(v)} style={styles.play} hitSlop={8}>
              <IconSymbol name={playingId === v.id ? 'pause.fill' : 'play.fill'} size={14} color={busyId === v.id ? Romance.sub : Romance.ink} />
            </Pressable>
          </View>
        ))}
      </View>
      <Button label={t('换一批')} variant="outline" size="sm" style={styles.more} onPress={() => setRound((r) => r + 1)} />
    </Field>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    rows: { gap: Space.inline },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    chip: { minWidth: 88, alignItems: 'center' },
    tags: { flex: 1, fontSize: 12, color: Romance.sub },
    play: {
      width: 30,
      height: 30,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    more: { alignSelf: 'flex-start', marginTop: Space.inlineLoose },
  })
);
