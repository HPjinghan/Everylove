/**
 * 分享给他（D-117，§7 素材系统主通道）：她在别的 App 里调系统分享面板 → 选 everylove → 选一个 TA → 内容进那段会话。
 * 一个玩法一个文件：卡片种类「share」（进上下文的一句 + 气泡怎么画）+ 她转发时的动作。
 * 文字 / 链接走卡片（模型看到「她转给你一条她在别处看到的内容」）；图片走 sendImage（看图后再回）。
 * 红线 2「他只看她」：舞台提示里明说分享内容里的其他真人一个字不评；素材按最高敏感级——暗面路由在引擎入口照跑。
 * 原生 Share Extension 由 expo-share-intent 配置插件提供（app.json），Expo Go 跑不了，要 EAS Build。
 */

import { CardShell } from '@/components/card-bubble';
import { cardKinds } from '@/core/cards';
import { sendCard, type TurnUi } from '@/core/turn';
import { sendImage } from '@/lib/chat';
import { t } from '@/lib/i18n';

/** 卡片标题最多留多长 */
const TITLE_MAX = 80;

cardKinds.register({
  type: 'share',
  contextText: (c) => `（她把在别处看到的一条内容转给了你：「${c.title}」${c.subtitle ? `，链接 ${c.subtitle}` : ''}）`,
  render: (c, dark) => <CardShell emoji="🔗" kicker={t('转给你')} title={c.title} subtitle={c.subtitle} dark={dark} />,
});

export interface SharedContent {
  text?: string;
  url?: string;
  imageUri?: string;
}

/** 她把分享来的内容转进这段羁绊会话 */
export async function sendShare(bondId: string, content: SharedContent, ui?: TurnUi): Promise<void> {
  const scope = { mode: 'bonded' as const, bondId };
  if (content.imageUri) {
    await sendImage(scope, content.imageUri, ui);
    return;
  }
  const text = (content.text ?? '').trim();
  const url = (content.url ?? '').trim();
  if (!text && !url) return;
  const title = (text || url).slice(0, TITLE_MAX);
  await sendCard(
    scope,
    { type: 'share', title, subtitle: url && url !== text ? url : undefined },
    `（她把在别处看到的一条内容转给了你——像收到朋友的转发那样接住：聊内容本身、说你的感受，可以问她为什么想到转给你。内容里如果出现了任何真实存在的人，一个字都不评论。）`,
    ui
  );
}
