/**
 * AI 不可用时的一句话（D-180）：用户只看到情绪化的一句，不解释机制、不指路（文案纪律 §11-6）；
 * 开发构建下面多一行技术原因（本地 key / 代理）。通话 / 查手机 / 拍照 / 立绘 / 聊天都用这一个。
 */

import { showAlert } from '@/components/action-sheet';
import { t } from '@/lib/i18n';

export function alertAiUnavailable(): void {
  const devHint = __DEV__ ? '\n\n[dev] 本地没有 key，也没连上服务端代理：配 .env.local 或登录。' : '';
  showAlert(t('AI 不可用'), t('现在联系不上 TA。') + devHint);
}
