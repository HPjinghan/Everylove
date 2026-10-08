/**
 * 语音时长不够时的提示（D-210）：Free 没有语音（新用户送的 5 分钟只能打电话），订阅用户用完了可以买分钟包。
 * 聊天输入栏的 micGate、通话页拨号前共用。
 */

import { router } from 'expo-router';

import { showAlert } from '@/components/action-sheet';
import { voiceMessageLeft } from '@/features/traffic';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/** 没时长了：说清是订阅的东西还是今天用完了，给一个去设置的按钮 */
export function alertNoVoice(): void {
  const free = useAppStore.getState().plan === 'free';
  showAlert(free ? t('语音是订阅才有的') : t('语音时长用完了'), free ? t('订阅后每天都能发语音、打电话。') : t('可以买语音分钟包，不过期。'), [
    { text: t('取消'), style: 'cancel' },
    { text: free ? t('看看订阅') : t('去买'), onPress: () => router.push('/apps/settings' as never) },
  ]);
}

/** 聊天输入栏开始录音前问一声 */
export function micGate(): boolean {
  if (voiceMessageLeft() > 0) return true;
  alertNoVoice();
  return false;
}
