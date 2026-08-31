/**
 * 拍立得（D-056）：生成照片的统一呈现——白框相纸 + 下方手写字，微微歪着（每张的倾角由 key 决定）。
 * 会话流里居中（不是对话气泡——照片不是谁「说」的话，是你们的东西）；相册同框。
 * PhotoViewer：点开看大图 + 分享（expo-sharing 调系统分享面板）。
 */

import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

/** 每张照片一个稳定的小倾角（-2° ~ 2°），像随手贴在桌上 */
export function tiltFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 5) - 2;
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
  const pad = Math.max(6, Math.round(width * 0.045));
  const img = width - pad * 2;
  const small = width < 140;
  const rotate = tiltKey ? `${tiltFor(tiltKey)}deg` : '0deg';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.frame, { width, padding: pad, transform: [{ rotate }] }]}>
      <Image source={{ uri }} style={{ width: img, height: img, backgroundColor: '#ECECEC' }} contentFit="cover" />
      <View style={[styles.foot, { height: small ? pad * 2 : 34 }]}>
        {caption && !small ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
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
              <Pressable style={styles.viewerBtn} onPress={share}>
                <Text style={styles.viewerBtnText}>{t('分享')}</Text>
              </Pressable>
              <Pressable style={[styles.viewerBtn, styles.viewerBtnDim]} onPress={onClose}>
                <Text style={styles.viewerBtnText}>{t('关闭')}</Text>
              </Pressable>
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
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    foot: { alignItems: 'center', justifyContent: 'center' },
    caption: { fontSize: 12, color: '#6B5B4E', fontStyle: 'italic' },
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(20,12,14,0.94)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    viewerBtns: { flexDirection: 'row', gap: 14, marginTop: 26 },
    viewerBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 22,
      paddingHorizontal: 30,
      paddingVertical: 12,
    },
    viewerBtnDim: { backgroundColor: 'rgba(255,255,255,0.18)' },
    viewerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  })
);
