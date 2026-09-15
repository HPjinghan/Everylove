/**
 * TA 发图（D-130 → D-135，Harper：「聊天里要允许生图，比如我给他点了外卖，他收到之后我要看个图」）：
 * - 她要看 / 东西刚送到（她的话或舞台提示里有「拍给我看」「送到」这类词）：随时可以发，不走主动那三道门；
 * - 主动拍一张：这一轮过了三道门（LV2+、10 条冷却、概率，lib/extras.ts）才把选项给模型，落了记冷却。
 * TA 写了 [发图 描述] 就先落一条「照片冲洗中」的图片消息，后台按角色画风生成（外出拍照同一条管线，按真实用量扣流量），洗好回填；
 * 没洗出来标 failed、不重试。主动找她那条也可能带一张（lib/reach-out.ts applyMarkers）。
 */

import { buildHisPhotoPrompt, HIS_PHOTO_MARK, HIS_PHOTO_PATTERN, hisPhotoLines, PHOTO_REQUEST_PATTERN } from '@/content/prompts';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { BONDED_CHAT } from '@/features/prompts';
import { extraEligible, extraOffered, himTurnCount } from '@/lib/extras';
import { uid } from '@/lib/format';
import { generateScenePhoto, imageKeyReady } from '@/lib/imagegen';
import type { ChatMessage, EngineContext } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 这一轮是她要看 / 东西送到（看她这句与舞台提示） */
export function photoRequested(ctx: Pick<EngineContext, 'userText'>): boolean {
  return PHOTO_REQUEST_PATTERN.test(ctx.userText);
}

promptSections.register({
  name: 'his-photo',
  modes: BONDED_CHAT,
  order: ORDER.hisPhoto,
  lines: (ctx, env) => {
    if (!ctx.bond || !imageKeyReady()) return [];
    return hisPhotoLines(extraOffered(ctx.bond, ctx.character, 'photo', ctx.history, env.now.getTime()));
  },
});

replyMarkers.register({
  key: 'hisPhoto',
  mark: HIS_PHOTO_MARK,
  pattern: HIS_PHOTO_PATTERN,
  async apply({ scope, mode, ctx, value, unread }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    const desc = (value ?? '').trim();
    if (!bond || !desc || !imageKeyReady()) return;
    const now = Date.now();
    const requested = photoRequested(ctx);
    if (!requested && !extraEligible(bond, 'photo', bond.messages, now)) return;
    const id = uid('m');
    const msg: ChatMessage = { id, from: 'him', kind: 'image', text: '', caption: desc, at: now, mediaStatus: 'pending' };
    mode.append(scope, [msg], { unreadDelta: unread ? 1 : 0 });
    // 主动拍的才记冷却；她要的 / 送到的不占主动的额度
    if (!requested) useAppStore.getState().setExtraFired(bond.id, himTurnCount(useAppStore.getState().bonds.find((b) => b.id === bond.id)?.messages ?? []), now);
    try {
      const uri = await generateScenePhoto(buildHisPhotoPrompt(ctx.character, { desc }), ctx.character);
      useAppStore.getState().patchMessage({ bondId: bond.id }, id, { imageUri: uri, mediaStatus: undefined });
    } catch (e) {
      console.warn('[his-photo] 照片没洗出来：', e);
      useAppStore.getState().patchMessage({ bondId: bond.id }, id, { mediaStatus: 'failed' });
    }
  },
});
