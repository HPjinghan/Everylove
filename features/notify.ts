/**
 * 轻提示接线（D-179）：底座（core/turn）只喊「要提示一句」，这里接到界面的 showToast。
 * 测试里不装这个文件 → 底座默认只记 warn。
 */

import { showToast } from '@/components/toast';
import { setTurnNotifier } from '@/core/turn';

setTurnNotifier((text, durationMs) => showToast(text, { durationMs }));
