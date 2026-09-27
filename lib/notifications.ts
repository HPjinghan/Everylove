/**
 * 本地通知：TA 主动找她（D-114）/ 召回（D-126）/ 外卖到了（D-129）都用本地定时通知（Expo Go 不支持远程推送，D-002）。
 * 通知带 data { bondId, screen? }，点开直达会话或对应的 App（D-170，`onNotificationOpened`）；北极星「主动消息回复率」的入口在这里。
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

/** 只查不问（排通知时用；问权限的时机在缔结那一刻，D-120） */
export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** 通知点开去哪（D-170）：有羁绊 → 会话页；没有羁绊的（她自己的外卖）→ screen */
export interface NotificationTarget {
  bondId?: string;
  screen?: string;
}

export async function scheduleArrivalNotification(
  title: string,
  body: string,
  at: Date,
  bondId: string,
  extra: { screen?: string } = {}
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { bondId, ...extra } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch {
    // Expo Go 环境下如遇不可用，开门仍会在 App 打开时于会话内投递
    return null;
  }
}

/**
 * 她点开了一条通知（D-170）：App 在前台 / 后台时由监听器收到；冷启动（点通知把 App 拉起来）的那一条从 last response 取一次并清掉，
 * 不会在下次挂载时重复处理。返回取消订阅。
 */
export function onNotificationOpened(cb: (target: NotificationTarget) => void): () => void {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const data = (r?.notification.request.content.data ?? {}) as NotificationTarget;
    if (data.bondId || data.screen) cb(data);
  };
  void Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (!r) return;
      handle(r);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

export async function cancelScheduled(notifId?: string) {
  if (!notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // ignore
  }
}
