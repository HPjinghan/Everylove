/**
 * TA 的声音（D-139 / D-230 / D-250，创造「细节」页、恋爱类型下面）：
 * 第一行「跟着恋爱类型」= 不选（按恋爱类型取默认声，写出现在会是哪一把）；下面列出同性别的全部声音——
 * 每把写它给人的感觉（vibe）和它是哪几种恋爱类型的默认声，点行选中、点右边的键试听一句（ElevenLabs 合成、走 tts 缓存）。
 * 当前恋爱类型的那把排第一。音色池里没有这门语言的声线时整块不显示（无供给不摆入口）。
 */

import { memo, useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Divider } from '@/components/card';
import { Field } from '@/components/input';
import { showToast } from '@/components/toast';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import type { VoiceOption } from '@/content/voices';
import type { Lang } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { defaultVoiceId, voicesFor } from '@/lib/speech';
import { previewVoice } from '@/lib/tts';
import { audioSession, claimVoicePlayback } from '@/lib/audio-session';

export const VoicePicker = memo(function VoicePicker({
  lang,
  gender,
  loveStyle,
  value,
  onChange,
  sampleText,
  pronoun,
}: {
  lang: Lang;
  gender: VoiceOption['gender'];
  /** 当前选的恋爱类型（label）：决定默认声、排第一 */
  loveStyle: string | undefined;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** 试听念的那句（开场白优先） */
  sampleText: string;
  pronoun: '他' | '她' | 'TA';
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // 放完了就把键换回播放
  useEffect(() => {
    if (status.didJustFinish) setPlayingId(null);
  }, [status.didJustFinish]);

  const all = voicesFor(lang);
  if (all.length === 0) return null;
  const pool = all.filter((v) => gender === 'nonbinary' || v.gender === gender || v.gender === 'nonbinary');
  const fallbackId = defaultVoiceId({ id: '', gender, loveStyle }, lang);
  const fallback = all.find((v) => v.id === fallbackId);
  // 当前恋爱类型的那把排第一，其余按池子顺序
  const list = [...pool].sort((a, b) => Number(b.id === fallbackId) - Number(a.id === fallbackId));

  const listen = async (key: string, voiceId: string) => {
    if (busyId) return;
    if (playingId === key) {
      player.pause();
      setPlayingId(null);
      return;
    }
    setBusyId(key);
    const uri = await previewVoice(sampleText, voiceId, pronoun);
    setBusyId(null);
    if (!uri) {
      showToast(t('试听没成功'));
      return;
    }
    await audioSession.playback();
    claimVoicePlayback(() => {
      player.pause();
      setPlayingId(null);
    });
    player.replace({ uri });
    player.seekTo(0);
    player.play();
    setPlayingId(key);
  };

  const row = (key: string, voiceId: string | undefined, title: string, sub: string, selected: boolean, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} style={styles.row}>
      <View style={styles.check}>{selected ? <IconSymbol name="checkmark" size={15} color={Romance.accentStrong} /> : null}</View>
      <View style={styles.text}>
        <Text style={[styles.title, selected && styles.titleOn]}>{title}</Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {voiceId ? (
        <Pressable onPress={() => void listen(key, voiceId)} style={styles.play} hitSlop={8}>
          <IconSymbol name={playingId === key ? 'pause.fill' : 'play.fill'} size={14} color={busyId === key ? Romance.sub : Romance.ink} />
        </Pressable>
      ) : null}
    </Pressable>
  );

  return (
    <Field label={t('TA 的声音')}>
      <Card padded={false}>
        {row(
          'default',
          fallback?.id,
          t('跟着恋爱类型'),
          fallback ? t(fallback.vibe) : '',
          !value,
          () => onChange(undefined)
        )}
        {list.map((v) => (
          <View key={v.id}>
            <Divider soft style={styles.divider} />
            {row(
              v.id,
              v.id,
              t(v.vibe),
              v.styles.map((st) => t(st)).join(' · '),
              value === v.id,
              () => onChange(v.id)
            )}
          </View>
        ))}
      </Card>
    </Field>
  );
});

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, paddingVertical: Space.inlineLoose, paddingHorizontal: Space.cardX },
    check: { width: 16, alignItems: 'center' },
    text: { flex: 1 },
    title: { fontSize: Type.scale.body.size, color: Romance.ink },
    titleOn: { color: Romance.accentStrong, fontWeight: '600' },
    sub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
    divider: { marginLeft: Space.cardX + 16 + Space.inlineLoose },
    play: {
      width: 30,
      height: 30,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
