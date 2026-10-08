/**
 * 震动反馈（D-207）：界面里所有震动都从这里叫，一处定口径、失败静默（模拟器 / 没有 Taptic 的设备）。
 * 口径：tick = 越过一个档位（滑卡过阈值、转盘停）；tap = 轻点确认（发出一条、点赞、加减数量）；
 * soft = TA 的一条消息落下（很轻，连着几条也不吵）；success = 好事落地（配对、抽中、好奇满、升级）；warn = 没拿到 / 亏了。
 */

import * as Haptics from 'expo-haptics';

const quiet = (p: Promise<void>) => void p.catch(() => {});

export const haptic = {
  tick: () => quiet(Haptics.selectionAsync()),
  tap: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  soft: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  medium: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
