/**
 * 声音不够时的提示：
 * - TA 的语音 / 电话按分钟（D-210）：Free 没有（新用户送的 5 分钟只能打电话），订阅用户用完了可以买分钟包；
 * - 她的麦克风人人可用（D-211），识别跟打字一样走流量——流量用完了才拦，免得录完才发现发不出。
 */

import { router } from 'expo-router';

import { showAlert } from '@/components/action-sheet';
import { trafficLeft } from '@/features/traffic';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/** TA 的声音没时长了：说清是订阅的东西还是今天用完了，给一个去设置的按钮 */
export function alertNoVoice(): void {
  const free = useAppStore.getState().plan === 'free';
  showAlert(free ? t('语音是订阅才有的') : t('语音时长用完了'), free ? t('订阅后每天都能听到 TA 的语音、打电话。') : t('可以买语音分钟包，不过期。'), [
    { text: t('取消'), style: 'cancel' },
    { text: free ? t('看看订阅') : t('去买'), onPress: () => router.push('/apps/settings' as never) },
  ]);
}

/** 聊天输入栏开始录音前问一声：流量用完了就不录 */
export function micGate(): boolean {
  if (trafficLeft() > 0) return true;
  showAlert(t('流量用完了'), t('流量包不订阅也能买。'), [
    { text: t('取消'), style: 'cancel' },
    { text: t('去买'), onPress: () => router.push('/apps/settings' as never) },
  ]);
  return false;
}
