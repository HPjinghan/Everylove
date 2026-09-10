/**
 * ============================================================================
 *  全部 Prompt 文本都在这个目录里（D-017 → D-087 拆成一用途一文件）——想改「TA 怎么说话 / 画面怎么画 / 记忆怎么提」，找对应的文件。
 * ============================================================================
 *
 *   shared.ts        通用块：消息进模型的文字、时间感、人称、角色设定块、她的身份块、红线、关系阶段、记忆注入
 *   chat.ts          一般对话：初识 / 亲密（第一行、台词样本、分寸、规则、长度）
 *   outing.ts        外出：第一行、此刻、写法、陌生人分寸、输出格式、离线开场白
 *   call.ts          通话口吻
 *   his-notes.ts     TA 的记事本
 *   phone.ts         查手机（TA 的手机段 + 暗号）/ 看我的手机
 *   red-packet.ts    红包规则 + 暗号
 *   image-common.ts  生图共用：主体描述、红线句
 *   portrait.ts      立绘：画风表、system、构图（调图工具实时读它）
 *   photo.ts         外出拍照
 *   memory.ts        记忆提取（含外出 / 记事本并入的说明段）
 *   social.ts        X 回帖与发帖
 *   appointment.ts   约定识别 / 爽约那一句
 *   caption.ts       看图
 *   heartbeat.ts     心跳三段式模板
 *   create.ts        创造描述解析
 *   world.ts         世界书：TA 所在的世界（D-110）
 *   circle.ts        TA 身边的人：生成 + 注入（D-110）
 *
 * 不在这里的：
 *   - 角色人设 persona / 追法 pursuit / 外貌 look / 人称 pronoun / 台词库 → content/characters/（zh / en / ja 各一份，D-093）
 *   - 地点场景描写 → content/places.ts
 *   - 玩法自己的一句话提示语（卡片进上下文的那句、发出时的舞台提示）→ features/*.tsx（D-086）
 *   - 各段进哪些模式、排第几 → features/prompts.ts（core/prompt 分段表）
 *   - 模型 ID、max_tokens、图片尺寸等参数 → features/providers.ts、lib/engine.ts、lib/imagegen.ts
 *   - 暗面路由的触发词与回复 → content/characters/index.ts 的 DARK_SIDE_PATTERN / darkSideReply（三语）
 *
 * 模型最终看到的整段字：tests/__snapshots__/prompts*.snap（npm test 会逐字校验）。标了「红线」的段落对应 CLAUDE.md §9，请勿删。
 */

import { assembleSystemPrompt } from '@/core/prompt';
import type { EngineContext } from '@/lib/types';

export * from './appointment';
export * from './call';
export * from './caption';
export * from './chat';
export * from './circle';
export * from './create';
export * from './heartbeat';
export * from './his-notes';
export * from './image-common';
export * from './memory';
export * from './outing';
export * from './phone';
export * from './photo';
export * from './portrait';
export * from './red-packet';
export * from './shared';
export * from './social';
export * from './world';

/** 分发器：引擎只调这一个——由 core/prompt 按分段表装配（分段在 features/prompts.ts 与各玩法里注册，D-086） */
export function buildChatSystemPrompt(ctx: EngineContext, now: Date = new Date()): string {
  return assembleSystemPrompt(ctx, { now });
}
