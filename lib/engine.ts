/**
 * ChatEngine：对话引擎抽象。
 * 系统层规则（情绪暗面路由、尺度、无 PUA）在入口处执行，任何引擎不可绕过——
 * 对应行为树「系统层锁死」。领养触发（他开口要联系方式）是产品触发器，
 * 由会话轮数决定，不交给模型（见 DECISIONS D-008）。
 */

import { DARK_SIDE_PATTERN, DARK_SIDE_REPLY, scriptFor } from '@/content/characters';
import type { EngineContext, EngineId, EngineReply } from '@/lib/types';

const ANTHROPIC_MODEL = 'claude-sonnet-5';

function pick<T>(arr: T[], salt = 0): T {
  return arr[Math.floor(Math.random() * 977 + salt) % arr.length];
}

/** 系统层前置检查：命中暗面路由则绕过一切角色扮演 */
export function darkSideCheck(userText: string): EngineReply | null {
  if (DARK_SIDE_PATTERN.test(userText)) {
    return { texts: [DARK_SIDE_REPLY], darkSide: true };
  }
  return null;
}

async function mockReply(ctx: EngineContext): Promise<EngineReply> {
  const script = scriptFor(ctx.character);
  const salt = ctx.history.length + ctx.userText.length;

  for (const t of script.triggers) {
    if (t.pattern.test(ctx.userText)) {
      const reply = pick(t.replies, salt);
      // 广场模式只回一条：他有点兴趣，但不太主动（免费层商业承重墙）
      return { texts: [reply] };
    }
  }

  if (ctx.mode === 'square') {
    return { texts: [pick(script.square, salt)] };
  }

  const main = pick(script.bonded, salt);
  const texts = [main];
  // 羁绊模式的主动性：偶尔追一句称呼，体现「被爱」
  if (ctx.bond && salt % 3 === 0) {
    texts.push(`${ctx.bond.nickname}，在想什么？说来听听。`);
  }
  return { texts };
}

function buildSystemPrompt(ctx: EngineContext): string {
  const script = scriptFor(ctx.character);
  const modeRule =
    ctx.mode === 'square'
      ? '当前是广场初识模式：你对用户有一点兴趣，但保持距离感。回复简短（1-2 句），不主动推进关系，不问连环问题，不过度热情。'
      : `当前是已交换联系方式的亲密模式：你是主动的一方。称呼用户「${ctx.bond?.nickname ?? '你'}」，语气亲近自然，回复 1-3 句。你会主动分享自己的日常，会记得用户说过的话。`;

  return [
    `你在扮演恋爱互动应用中的虚构角色「${ctx.character.name}」（${ctx.character.identity}）。`,
    `人设：${script.persona}`,
    `追法（亲密度阶梯即性格）：${script.pursuit}`,
    modeRule,
    '硬性规则（不可违反）：',
    '- 尺度：暧昧而克制，不出现露骨性内容。',
    '- 行为健康：绝不纠缠、不刷屏、不用愧疚感留住用户；用户想结束时体面告别。',
    '- 用户提到的任何其他真实人物，一律不评论。',
    '- 若用户表达自伤/自杀意念，停止角色扮演，温柔认真地回应并建议拨打心理援助热线 12356。',
    '- 始终用简体中文口语。动作/神态描写每条最多一处，用（）标注。',
  ].join('\n');
}

async function anthropicReply(ctx: EngineContext, apiKey: string): Promise<EngineReply> {
  const history = ctx.history
    .filter((m) => m.from !== 'system')
    .slice(-20)
    .map((m) => ({
      role: m.from === 'me' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(ctx),
      messages: [...history, { role: 'user', content: ctx.userText }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('empty reply');
  return { texts: [text] };
}

/**
 * 统一入口：暗面路由 → 所选引擎；Anthropic 失败时回落 Mock，保证「他一定会回」。
 */
export async function generateReply(
  ctx: EngineContext,
  engine: EngineId,
  apiKey: string
): Promise<EngineReply> {
  const dark = darkSideCheck(ctx.userText);
  if (dark) return dark;

  if (engine === 'anthropic' && apiKey) {
    try {
      return await anthropicReply(ctx, apiKey);
    } catch {
      return mockReply(ctx);
    }
  }
  return mockReply(ctx);
}

/** 领养触发器：广场会话中用户第 4 次发言后，他开口要联系方式 */
export const ADOPTION_OFFER_AFTER_TURNS = 4;
