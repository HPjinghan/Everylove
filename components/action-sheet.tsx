/**
 * 底部动作卡与确认卡（D-160）：替代系统 Alert / ActionSheet 的纸面样式——遮罩 ink 45%、白卡描边 r6、无阴影。
 * - ActionSheet：长按消息那类「几个动作选一个」：顶部一行摘要（13 muted）、动作行 15/500 ink（危险动作 accentStrong）、
 *   行间 1.5px 分区线，卡片下方 paper 底「取消」。
 * - ConfirmSheet：「真的要删？」那类二次确认：标题 16/600、说明 13/20 muted、取消 paper 底 / 确认 primary 描边
 *   （与「让 TA 看我的手机」的确认卡同一套，phones.tsx）。
 * 点遮罩 = 取消。
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import { Space } from '@/constants/design';
import { Romance, themed, withAlpha } from '@/constants/theme';
import { t } from '@/lib/i18n';

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable style={[styles.overlay, { paddingBottom: insets.bottom + Space.screen }]} onPress={onClose}>
      <Pressable onPress={() => {}}>{children}</Pressable>
    </Pressable>
  );
}

export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  /** 顶部一行摘要（比如被长按的那条消息），可不给 */
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Overlay onClose={onClose}>
        <Card padded={false}>
          {title ? (
            <>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Divider />
            </>
          ) : null}
          {actions.map((a, i) => (
            <View key={a.label}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={[styles.rowText, a.destructive && styles.rowDanger]}>{a.label}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
        <Button label={t('取消')} variant="paper" size="md" style={styles.cancel} onPress={onClose} />
      </Overlay>
    </Modal>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Overlay onClose={onClose}>
        <Card padded={false} style={styles.confirm}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {body ? <Text style={styles.confirmBody}>{body}</Text> : null}
          <View style={styles.confirmActions}>
            <Button label={t('取消')} variant="paper" size="md" style={styles.flex} onPress={onClose} />
            <Button
              label={confirmLabel}
              variant="primary"
              size="md"
              style={styles.flex}
              onPress={() => {
                onClose();
                onConfirm();
              }}
            />
          </View>
        </Card>
      </Overlay>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: Space.screen,
      backgroundColor: withAlpha(Romance.ink, 0.45),
    },
    title: { fontSize: 13, lineHeight: 18, color: Romance.sub, paddingVertical: Space.cardY, paddingHorizontal: 16 },
    row: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
    rowPressed: { backgroundColor: Romance.bg },
    rowText: { fontSize: 15, fontWeight: '500', color: Romance.ink },
    rowDanger: { color: Romance.accentStrong },
    cancel: { marginTop: Space.inlineLoose },
    confirm: { padding: 16 },
    confirmTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    confirmBody: { fontSize: 13, lineHeight: 20, color: Romance.sub, marginTop: 8 },
    confirmActions: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: 16 },
    flex: { flex: 1 },
  })
);
