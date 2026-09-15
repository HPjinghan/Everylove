/**
 * 外卖模拟系统（D-129）：她在「外卖」App 里从菜单（content/menu.ts）点东西——给自己或给缔结的 TA；TA 在聊天里给她点的（features/wallet.tsx 的
 * [点外卖 …]）也进同一份订单记录（store.orders）。一单 = 下单时刻 + 送达时刻，状态按时间推：商家接单 → 骑手取餐 → 在路上 → 已送达；
 * 送达那一刻本地通知；给 TA 点的走回合管线发一张外卖卡片，TA 按喜好反应（卡片 = 一次开口，D-126 来源表 card）。
 * 钱：Coin（lib/format money），从她的零钱扣，不够下不了单。
 */

import { menuItem, menuStore } from '@/content/menu';
import { deliveryArrivedUserLine } from '@/content/prompts';
import { respond, sendCard } from '@/core/turn';
import { bondScope } from '@/lib/chat';
import { money, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { hasNotificationPermission, scheduleArrivalNotification } from '@/lib/notifications';
import type { Order, OrderItem } from '@/lib/types';
import { DELIVERY_ETA_MIN } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

export type OrderStatus = 'accepted' | 'pickup' | 'riding' | 'delivered';

/** 下单后第几分钟进入下一段：前 2 分钟商家接单、到第 5 分钟骑手取到餐、之后在路上直到送达 */
export const ORDER_STAGE_MIN = { accepted: 2, pickup: 5 } as const;
/** 订单最多留几单 */
export const ORDERS_MAX = 50;

export function orderStatus(o: Pick<Order, 'at' | 'arriveAt'>, now = Date.now()): OrderStatus {
  if (now >= o.arriveAt) return 'delivered';
  const min = (now - o.at) / 60_000;
  if (min < ORDER_STAGE_MIN.accepted) return 'accepted';
  if (min < ORDER_STAGE_MIN.pickup) return 'pickup';
  return 'riding';
}

/** 状态一句话（界面与卡片共用） */
export function orderStatusLabel(o: Pick<Order, 'at' | 'arriveAt'>, now = Date.now()): string {
  const s = orderStatus(o, now);
  if (s === 'delivered') return t('已送达');
  if (s === 'accepted') return t('商家已接单');
  if (s === 'pickup') return t('骑手取餐中');
  return t('骑手在路上 · 约 {n} 分钟', { n: Math.max(1, Math.ceil((o.arriveAt - now) / 60_000)) });
}

/** 「珍珠奶茶 ×2、饭团」 */
export function orderTitle(o: Pick<Order, 'items'>): string {
  return o.items.map((i) => (i.qty > 1 ? `${t(i.name)} ×${i.qty}` : t(i.name))).join('、');
}

/** 骑手多久送到：10–20 分钟 */
export function etaAt(now = Date.now(), rand = Math.random()): number {
  const [lo, hi] = DELIVERY_ETA_MIN;
  return now + Math.round((lo + rand * (hi - lo)) * 60_000);
}

export interface PlaceOrderInput {
  storeId: string;
  items: { itemId: string; qty: number }[];
  note?: string;
  /** 'me' = 给自己；否则是羁绊 id */
  to: 'me' | string;
}

/** 她下单：扣零钱 → 记订单 → 排送达通知；给 TA 点的再发一张卡片、TA 反应。返回没成的原因 */
export async function placeOrder(input: PlaceOrderInput): Promise<{ ok: true; orderId: string } | { ok: false; reason: 'empty' | 'balance' | 'bond' }> {
  const store = useAppStore.getState();
  const shop = menuStore(input.storeId);
  const items: OrderItem[] = input.items
    .filter((i) => i.qty > 0)
    .map((i) => {
      const m = menuItem(input.storeId, i.itemId);
      return m ? { name: m.name, qty: i.qty, price: m.price } : null;
    })
    .filter((x): x is OrderItem => !!x);
  if (!shop || !items.length) return { ok: false, reason: 'empty' };
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  if (store.wallet.balance < total) return { ok: false, reason: 'balance' };
  const bond = input.to === 'me' ? undefined : store.bonds.find((b) => b.id === input.to);
  if (input.to !== 'me' && !bond) return { ok: false, reason: 'bond' };
  const now = Date.now();
  const order: Order = {
    id: uid('o'),
    at: now,
    from: 'me',
    bondId: bond?.id,
    storeId: shop.id,
    items,
    total,
    note: input.note?.trim() || undefined,
    arriveAt: etaAt(now),
  };
  const title = orderTitle(order);
  store.creditWallet({
    amount: -total,
    kind: 'delivery',
    note: bond ? t('给 {name} 点的{item}', { name: bond.name, item: title }) : t('给自己点的{item}', { item: title }),
    bondId: bond?.id,
  });
  store.addOrder(order);
  const ok = await hasNotificationPermission().catch(() => false);
  if (ok && !bond) void scheduleArrivalNotification(t('外卖'), t('你的{item}到了', { item: title }), new Date(order.arriveAt), '');
  if (bond) {
    void sendCard(
      { mode: 'bonded', bondId: bond.id },
      { type: 'delivery', title, subtitle: order.note, amount: total, arriveAt: order.arriveAt, orderId: order.id },
      `（她给你点了一份外卖：${title}${order.note ? `，留言「${order.note}」` : ''}，骑手大约 ${Math.round((order.arriveAt - now) / 60_000)} 分钟后送到。按你的喜好和性格反应——喜欢的东西就是喜欢，讨厌的东西可以嫌弃但要接住她的心意；不用说谢谢客套话。）`,
      { unread: true, pace: 'none' }
    );
  }
  return { ok: true, orderId: order.id };
}

/** 送到多久内还值得报到（更早的只标掉不说） */
const ARRIVAL_WINDOW_MS = 12 * 3600_000;
const arriving = new Set<string>();

/** 启动 / 回前台：她给 TA 点的外卖到了 → TA 主动说一句、拍一张（D-135）；一单只报到一次。返回报到的单数 */
export async function deliverDueArrivals(now = Date.now()): Promise<number> {
  let n = 0;
  for (const o of useAppStore.getState().orders) {
    if (o.from !== 'me' || !o.bondId || o.reacted || o.arriveAt > now || arriving.has(o.id)) continue;
    arriving.add(o.id);
    try {
      useAppStore.getState().markOrderReacted(o.id);
      if (now - o.arriveAt > ARRIVAL_WINDOW_MS) continue;
      const { reply } = await respond(
        bondScope(o.bondId),
        deliveryArrivedUserLine({ title: orderTitle(o), note: o.note, minutesAgo: (now - o.arriveAt) / 60_000 }),
        { pace: 'none', unread: true }
      );
      if (reply) n++;
    } finally {
      arriving.delete(o.id);
    }
  }
  return n;
}

/** 给 Coin 显示的一份小计 */
export function lineTotal(price: number, qty: number): string {
  return money(price * qty);
}
