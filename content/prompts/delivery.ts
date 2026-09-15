/**
 * 外卖送到（D-135）：她给 TA 点的东西到了，TA 收到那一刻的舞台提示（user 文本，不入会话）——说一句收到的感觉，可以拍一张给她看。
 * 「送到」一词让 features/his-photo.tsx 把这一轮当成「她要看 / 东西送到」，发图不走主动那三道门。调度在 lib/delivery.ts。
 */

export function deliveryArrivedUserLine(input: { title: string; note?: string; minutesAgo: number }): string {
  const when = input.minutesAgo < 3 ? '刚刚' : `${Math.round(input.minutesAgo)} 分钟前`;
  return [
    `（她给你点的外卖${when}送到你手上了：${input.title}${input.note ? `，留言「${input.note}」` : ''}。`,
    '说一句收到时的感觉——按你的性格，喜欢的东西就是喜欢，不客套；1-2 句，像随手发的。',
    `顺手拍一张给她看：在回复最后单独一行写 [发图 一句话描述你拍到的它]（她看不到这行，她会收到照片）。）`,
  ].join('\n');
}
