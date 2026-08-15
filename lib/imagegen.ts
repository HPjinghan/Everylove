/**
 * 漫画显影：Qwen 文生图（阿里云百炼 DashScope）。
 * 一切显影由「他」以剧情语法送达（「给你讲个故事吧」→ 漫画在会话流里展开）。
 * 红线约束写死在 prompt：用户 POV 不入镜、暧昧合规、不做真人。
 * 生成图下载到本机（DashScope 的 URL 24 小时过期，相册是资产不能丢）。仅试装用（D-013）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { scriptFor } from '@/content/characters';
import { uid } from '@/lib/format';
import type { Bond, Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

export const ENV_QWEN_KEY = process.env.EXPO_PUBLIC_DASHSCOPE_API_KEY ?? '';
export const QWEN_IMAGE_MODEL = process.env.EXPO_PUBLIC_QWEN_IMAGE_MODEL || 'qwen-image';
const DASHSCOPE_BASE = process.env.EXPO_PUBLIC_DASHSCOPE_BASE || 'https://dashscope.aliyuncs.com';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 提交异步文生图任务并轮询到出图，下载到本机后返回本地 URI */
async function generateImage(prompt: string): Promise<string> {
  const submit = await fetch(`${DASHSCOPE_BASE}/api/v1/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ENV_QWEN_KEY}`,
      'x-dashscope-async': 'enable',
    },
    body: JSON.stringify({
      model: QWEN_IMAGE_MODEL,
      input: { prompt },
      parameters: { size: '1024*1024', n: 1, watermark: false },
    }),
  });
  if (!submit.ok) throw new Error(`DashScope submit ${submit.status}`);
  const task = (await submit.json()) as { output?: { task_id?: string } };
  const taskId = task.output?.task_id;
  if (!taskId) throw new Error('no task id');

  // 轮询：3 秒一次，最多 2 分钟
  for (let i = 0; i < 40; i++) {
    await wait(3000);
    const res = await fetch(`${DASHSCOPE_BASE}/api/v1/tasks/${taskId}`, {
      headers: { authorization: `Bearer ${ENV_QWEN_KEY}` },
    });
    if (!res.ok) throw new Error(`DashScope poll ${res.status}`);
    const data = (await res.json()) as {
      output?: { task_status?: string; results?: { url?: string }[]; message?: string };
    };
    const status = data.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = data.output?.results?.[0]?.url;
      if (!url) throw new Error('no image url');
      const dir = `${FileSystem.documentDirectory}comics/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const local = `${dir}${uid('img')}.png`;
      const dl = await FileSystem.downloadAsync(url, local);
      return dl.uri;
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`task ${status}: ${data.output?.message ?? ''}`);
    }
  }
  throw new Error('image generation timeout');
}

/** 从角色设定 + 最近对话组一格漫画的 prompt（POV：画他，不画用户） */
function buildComicPrompt(character: Character, bond: Bond): string {
  const script = scriptFor(character);
  const recent = bond.messages
    .filter((m) => m.kind === 'text' && m.from !== 'system')
    .slice(-8)
    .map((m) => `${m.from === 'me' ? '她' : character.name}：${m.text}`)
    .join('\n');
  return [
    '女性向少女漫画单格插画，日系条漫风格，柔和线条，浅色水彩质感，米白底玫瑰粉点缀。',
    `画面主角（唯一人物）：${character.name}，${character.identity}，${character.styleLabel ?? ''}，气质：${script.persona}`,
    `他正对镜头外的「你」说话——第一人称视角构图，画面里只有他一个人，绝对不出现第二个人物。`,
    `场景灵感来自他们最近的对话：\n${recent}`,
    '氛围：暧昧、温柔、克制，无露骨内容。不模仿任何真实人物长相。画面内不出现文字。',
  ].join('\n');
}

/**
 * 「给你讲个故事吧」：他先说一句，再把生成好的漫画送进会话流。
 * 没配 key 或生成失败时静默放弃（warn），不打断聊天。
 */
export async function deliverComic(bondId: string): Promise<boolean> {
  if (!ENV_QWEN_KEY) {
    console.warn('[imagegen] 没配 EXPO_PUBLIC_DASHSCOPE_API_KEY，跳过漫画显影');
    return false;
  }
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  const character = bond && findCharacter(bond.characterId);
  if (!bond || !character) return false;

  useAppStore.getState().appendBond(bondId, [
    {
      id: uid('m'),
      from: 'him',
      kind: 'text',
      text: `${bond.nickname}，给你画了点东西。等我一下。`,
      at: Date.now(),
    },
  ]);

  try {
    const imageUri = await generateImage(buildComicPrompt(character, bond));
    useAppStore.getState().appendBond(
      bondId,
      [
        {
          id: uid('m'),
          from: 'him',
          kind: 'image',
          text: '——刚才聊着聊着，脑子里就有了这个画面。',
          imageUri,
          at: Date.now(),
        },
      ],
      { affinityDelta: 2, unreadDelta: 1 }
    );
    return true;
  } catch (e) {
    console.warn('[imagegen] 漫画生成失败：', e);
    return false;
  }
}
