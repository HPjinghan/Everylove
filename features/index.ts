/**
 * 启动清单（D-086）：把所有玩法按顺序装进底座。app/_layout.tsx 顶部 `import '@/features'` 一次即可。
 * 顺序有意义：供应商与基础 prompt 分段先装；模式其次；玩法（卡片 / 暗号 / 钩子）随后；调度器最后。
 * 要关掉一个玩法：注释掉那一行（它注册的 prompt 分段、暗号、卡片、钩子一起消失）；要加一个：新建文件、在这里 import。
 */

import '@/features/providers';
import '@/features/prompts';
import '@/features/modes';

import '@/features/invite';
import '@/features/red-packet';
import '@/features/location';
import '@/features/phone-peek';

import '@/features/voice-reply';
import '@/features/memory';
import '@/features/appointment';
import '@/features/adoption';

import '@/features/schedulers';
