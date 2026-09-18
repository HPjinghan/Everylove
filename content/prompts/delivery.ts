/**
 * 外卖送到（D-135）：她给 TA 点的东西到了，TA 收到那一刻的舞台提示（user 文本，不入会话）——说一句收到的感觉，可以拍一张给她看。
 * 「送到」一词让 features/his-photo.tsx 把这一轮当成「她要看 / 东西送到」，发图不走主动那三道门。调度在 lib/delivery.ts。
 */

export function deliveryArrivedUserLine(input: { title: string; note?: string; minutesAgo: number }): string {
  const when = input.minutesAgo < 3 ? 'just now' : `${Math.round(input.minutesAgo)} minutes ago`;
  return [
    `(The food she ordered for you was delivered to you ${when}: ${input.title}${input.note ? `, with her note "${input.note}"` : ''}.`,
    "Say how it feels to receive it — as yourself; if you like it, you like it, no pleasantries; 1–2 sentences, like something dashed off.",
    `Snap a picture for her while you're at it: on a separate final line of your reply write [发图 东西|one sentence describing what you photographed] (only the thing, no people in the frame; she can't see this line, she receives a photo).)`,
  ].join('\n');
}
