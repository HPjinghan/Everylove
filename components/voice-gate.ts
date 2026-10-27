/**
 * 声音不够时的提示：
 * - TA 的语音 / 电话按分钟、不扣流量（D-240）：订阅每 30 天给、新用户送 5 分钟（只能打电话），用完了谁都能买分钟包；
 * - 她的麦克风人人可用（D-211），识别跟打字一样走流量——流量用完了才拦，免得录完才发现发不出。
 */

import { router } from 'expo-router';

import { showAlert } from '@/components/action-sheet';
import { trafficLeft } from '@/features/traffic';
import { t } from '@/lib/i18n';

/** TA 的声音没分钟了：分钟包谁都能买，给一个去设置的按钮 */
export function alertNoVoice(): void {
  showAlert(t('语音时长用完了'), t('可以买语音分钟包，不过期。'), [
    { text: t('取消'), style: 'cancel' },
    { text: t('去买'), onPress: () => router.push('/apps/settings' as never) },
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
