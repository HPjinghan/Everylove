/**
 * 拍立得（D-056；D-100 纸面）：生成照片的统一呈现——白框相纸 1.5px ink 描边 r6、内距 6/6/16、照片区 1:1（r4）、
 * 下方 Fredoka 10 muted 手写字，微微歪着（±0.6–1.8°，倾角由 key 决定）；无阴影。
 * 会话流里居中（不是对话气泡——照片不是谁「说」的话，是你们的东西）；相册同框。
 * PhotoViewer：点开看大图 + 分享（expo-sharing 调系统分享面板）。
 */

import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { POLAROID_TILTS, Shape } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { t } from '@/lib/i18n';

/** 每张照片一个稳定的小倾角（±0.6–1.8°），像随手贴在桌上 */
export function tiltFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return POLAROID_TILTS[Math.abs(h) % POLAROID_TILTS.length];
}

export function Polaroid({
  uri,
  caption,
  width = 210,
  tiltKey,
  onPress,
  onLongPress,
}: {
  uri: string;
  caption?: string;
  width?: number;
  /** 倾角种子（通常传消息 id）；不传则不歪 */
  tiltKey?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const pad = 6;
  const img = width - pad * 2 - Shape.stroke * 2;
  const rotate = tiltKey ? `${tiltFor(tiltKey)}deg` : '0deg';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.frame, { width, transform: [{ rotate }] }]}>
      <Image source={{ uri }} style={[styles.photo, { width: img, height: img }]} contentFit="cover" />
      <Text style={styles.caption} numberOfLines={1}>
        {caption ?? ' '}
      </Text>
    </Pressable>
  );
}

export interface ViewerShot {
  uri: string;
  caption?: string;
}

/** 大图查看：暗场 + 大拍立得 + 分享 */
export function PhotoViewer({ shot, onClose }: { shot: ViewerShot | null; onClose: () => void }) {
  const share = async () => {
    if (!shot) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t('这台设备不支持分享'), t('换真机试试。'));
      return;
    }
    await Sharing.shareAsync(shot.uri).catch(() => {});
  };
  return (
    <Modal visible={!!shot} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewer} onPress={onClose}>
        {shot ? (
          <>
            <Pressable onPress={() => {}}>
              <Polaroid uri={shot.uri} caption={shot.caption} width={300} />
            </Pressable>
            <View style={styles.viewerBtns}>
              <Button label={t('分享')} onPress={share} size="md" />
              <Button label={t('关闭')} onPress={onClose} size="md" variant="secondary" />
            </View>
          </>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    frame: {
      backgroundColor: Romance.card,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radius,
      paddingTop: 6,
      paddingHorizontal: 6,
      paddingBottom: 16,
      alignItems: 'center',
    },
    photo: { borderRadius: Shape.radiusInner, backgroundColor: Romance.bg },
    caption: { fontFamily: Fonts.label, fontSize: 10, color: Romance.sub, marginTop: 6, textAlign: 'center' },
    viewer: {
      flex: 1,
      backgroundColor: withAlpha(Romance.ink, 0.92),
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    viewerBtns: { flexDirection: 'row', gap: 14, marginTop: 26 },
  })
);
