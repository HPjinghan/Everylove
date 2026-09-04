/**
 * 卡片消息的种类（D-086）：会话「+」面板发出的东西（外出邀请 / 红包 / 位置 / 想看手机……）。
 * 一种卡片 = 一条注册：模型看到它时的那句话（contextText）+ 气泡里怎么画（render）+ 气泡底色（可选）。
 * 「模型看得见的，日志里必须有」：卡片本身存在 ChatMessage.card 上，进上下文的文字由 contextText 从卡片重建。
 * 加一种卡片 = 新建一个 features/xxx.tsx 注册进来，会话页与 messageContextText 都不用改。
 */

import type { ReactNode } from 'react';

import { createRegistry } from '@/core/registry';
import type { ChatCard } from '@/lib/types';

export interface CardKind {
  /** ChatCard.type */
  type: string;
  /** 这张卡进模型上下文时的一句话（TA 看到的是「她做了什么」） */
  contextText(card: ChatCard): string;
  /** 气泡内容；不提供则由会话组件画一张只有标题的通用卡 */
  render?(card: ChatCard, dark: boolean): ReactNode;
  /** 整个气泡染色（红包用） */
  bubbleColor?: string;
}

export const cardKinds = createRegistry<CardKind>('cardKinds', (c) => c.type);

export function cardContextText(card: ChatCard): string {
  return cardKinds.get(card.type)?.contextText(card) ?? `（她发来一张卡片：${card.title}）`;
}
