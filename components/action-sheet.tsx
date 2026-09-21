/**
 * 底部动作卡与确认卡（D-160 / D-164）：替代系统 Alert / ActionSheet 的纸面样式——遮罩 ink 45%、白卡描边 r6、无阴影。
 * - ActionSheet：长按消息那类「几个动作选一个」：顶部摘要（13 muted）、动作行 15/500 ink（危险动作 accentStrong）、
 *   行间 1.5px 分区线，卡片下方 paper 底「取消」。
 * - ConfirmSheet：「真的要删？」那类二次确认：标题 16/600、说明 13/20 muted、取消 paper 底 / 确认 primary 描边
 *   （与「让 TA 看我的手机」的确认卡同一套，phones.tsx）。
 * - showAlert(title, body?, buttons?)：与 Alert.alert 同签名的全局入口（D-164，全项目不再用系统弹窗）——
 *   没有按钮 = 通知卡（一颗「好」）；一个非取消按钮 = 确认卡；两个以上 = 动作卡；style 'cancel' 的按钮变成 paper「取消」。
 *   宿主 <SheetHost /> 挂在根布局，一次只出一张，连着弹的排队、上一张淡出后再出。
 * 点遮罩 = 取消。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable style={[styles.overlay, { paddingBottom: insets.bottom + Space.screen }]} onPress={onClose}>
      <Pressable onPress={() => {}}>{children}</Pressable>
    </Pressable>
  );
}

/** 说明文字：长的（记忆库那种）能滚 */
function Body({ text, style }: { text: string; style?: object }) {
  return (
    <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollInner} bounces={false}>
      <Text style={[styles.confirmBody, style]}>{text}</Text>
    </ScrollView>
  );
}

export function ActionSheet({
  visible,
  title,
  body,
  actions,
  cancelLabel,
  onClose,
}: {
  visible: boolean;
  /** 顶部一行摘要（比如被长按的那条消息），可不给 */
  title?: string;
  /** 摘要下的说明，可不给 */
  body?: string;
  actions: SheetAction[];
  cancelLabel?: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Overlay onClose={onClose}>
        <Card padded={false}>
          {title || body ? (
            <>
              <View style={styles.head}>
                {title ? (
                  <Text style={body ? styles.confirmTitle : styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                ) : null}
                {body ? <Body text={body} style={styles.headBody} /> : null}
              </View>
              <Divider />
            </>
          ) : null}
          {actions.map((a, i) => (
            <View key={`${i}-${a.label}`}>
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
        <Button label={cancelLabel ?? t('取消')} variant="paper" size="md" style={styles.cancel} onPress={onClose} />
      </Overlay>
    </Modal>
  );
}

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Overlay onClose={onClose}>
        <Card padded={false} style={styles.confirm}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {body ? <Body text={body} /> : null}
          <View style={styles.confirmActions}>
            <Button label={cancelLabel ?? t('取消')} variant="paper" size="md" style={styles.flex} onPress={onClose} />
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

/** 通知卡：标题 + 说明 + 一颗按钮 */
function NoticeSheet({
  visible,
  title,
  body,
  label,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Overlay onClose={onClose}>
        <Card padded={false} style={styles.confirm}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {body ? <Body text={body} /> : null}
          <View style={styles.confirmActions}>
            <Button label={label} variant="primary" size="md" style={styles.flex} onPress={onClose} />
          </View>
        </Card>
      </Overlay>
    </Modal>
  );
}

/* ── 全局入口：与 Alert.alert 同签名（D-164） ── */

export interface AlertButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
}

interface AlertRequest {
  title: string;
  body?: string;
  buttons: AlertButton[];
}

let emit: ((req: AlertRequest) => void) | null = null;

export function showAlert(title: string, body?: string, buttons?: AlertButton[]): void {
  emit?.({ title, body, buttons: buttons ?? [] });
}

/** 上一张淡出到下一张出现的间隔（RN Modal 连着开关会闪） */
const NEXT_DELAY_MS = 260;

export function SheetHost() {
  const [current, setCurrent] = useState<AlertRequest | null>(null);
  const queue = useRef<AlertRequest[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    emit = (req) => {
      queue.current.push(req);
      if (!timer.current) {
        setCurrent((cur) => cur ?? queue.current.shift() ?? null);
      }
    };
    return () => {
      emit = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const close = () => {
    setCurrent(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const next = queue.current.shift();
      if (next) setCurrent(next);
    }, NEXT_DELAY_MS);
  };

  if (!current) return null;
  const cancel = current.buttons.find((b) => b.style === 'cancel');
  const acts = current.buttons.filter((b) => b.style !== 'cancel');
  const onCancel = () => {
    close();
    cancel?.onPress?.();
  };
  if (acts.length === 0) {
    return <NoticeSheet visible title={current.title} body={current.body} label={cancel?.text ?? t('好')} onClose={onCancel} />;
  }
  if (acts.length === 1) {
    return (
      <ConfirmSheet
        visible
        title={current.title}
        body={current.body}
        confirmLabel={acts[0].text}
        cancelLabel={cancel?.text}
        onConfirm={() => acts[0].onPress?.()}
        onClose={onCancel}
      />
    );
  }
  return (
    <ActionSheet
      visible
      title={current.title}
      body={current.body}
      actions={acts.map((b) => ({ label: b.text, destructive: b.style === 'destructive', onPress: () => b.onPress?.() }))}
      cancelLabel={cancel?.text}
      onClose={onCancel}
    />
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
    head: { paddingVertical: Space.cardY, paddingHorizontal: 16, gap: 4 },
    title: { fontSize: 13, lineHeight: 18, color: Romance.sub },
    headBody: { marginTop: 0 },
    row: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
    rowPressed: { backgroundColor: Romance.bg },
    rowText: { fontSize: 15, fontWeight: '500', color: Romance.ink },
    rowDanger: { color: Romance.accentStrong },
    cancel: { marginTop: Space.inlineLoose },
    confirm: { padding: 16 },
    confirmTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    bodyScroll: { maxHeight: 260 },
    bodyScrollInner: { flexGrow: 0 },
    confirmBody: { fontSize: 13, lineHeight: 20, color: Romance.sub, marginTop: 8 },
    confirmActions: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: 16 },
    flex: { flex: 1 },
  })
);
