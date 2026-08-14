/**
 * 八点开门：试装阶段用本地定时通知实现（Expo Go 不支持远程推送，见 DECISIONS D-002）。
 * 北极星体验是「他说到做到」——通知必须准时。
 */

import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** 下一个晚八点（若今天 20:00 未过则今天，否则明天） */
export function nextEightPM(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= from.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** 开门是今晚还是明晚（他先走的台词用） */
export function arrivalTimeLabel(arrivalAt: number, from: Date = new Date()): string {
  const arrival = new Date(arrivalAt);
  const sameDay =
    arrival.getFullYear() === from.getFullYear() &&
    arrival.getMonth() === from.getMonth() &&
    arrival.getDate() === from.getDate();
  return sameDay ? '今晚八点' : '明晚八点';
}

export async function scheduleArrivalNotification(
  title: string,
  body: string,
  at: Date,
  bondId: string
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { bondId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch {
    // Expo Go 环境下如遇不可用，开门仍会在 App 打开时于会话内投递
    return null;
  }
}

export async function cancelScheduled(notifId?: string) {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // ignore
  }
}
