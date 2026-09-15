/**
 * TA 主动发图（D-130）：这一轮过了三道门（LV2+、10 条冷却、概率，lib/extras.ts）就把选项给模型；TA 写了 [发图 描述] 就先落一条
 * 「照片冲洗中」的图片消息，后台按角色画风生成（外出拍照同一条管线），洗好回填；没洗出来标 failed、不重试。
 * 一个玩法一个文件：prompt 分段 + 带数值的暗号 + 生成。主动找她那条也可能带一张（lib/reach-out.ts applyMarkers）。
 */

import { buildHisPhotoPrompt, HIS_PHOTO_LINES, HIS_PHOTO_MARK, HIS_PHOTO_PATTERN, timeOfDayLine } from '@/content/prompts';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { BONDED_CHAT } from '@/features/prompts';
import { extraEligible, extraOffered, himTurnCount } from '@/lib/extras';
import { uid } from '@/lib/format';
import { generateScenePhoto, imageKeyReady } from '@/lib/imagegen';
import type { ChatMessage } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { useAppStore } from '@/store/app-store';

promptSections.register({
  name: 'his-photo',
  modes: BONDED_CHAT,
  order: ORDER.hisPhoto,
  lines: (ctx, env) => {
    if (!ctx.bond || !imageKeyReady()) return [];
    return extraOffered(ctx.bond, ctx.character, 'photo', ctx.history, env.now.getTime()) ? HIS_PHOTO_LINES : [];
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
    if (!extraEligible(bond, 'photo', bond.messages, now)) return;
    const id = uid('m');
    const msg: ChatMessage = { id, from: 'him', kind: 'image', text: '', caption: desc, at: now, mediaStatus: 'pending' };
    mode.append(scope, [msg], { unreadDelta: unread ? 1 : 0 });
    useAppStore.getState().setExtraFired(bond.id, himTurnCount(useAppStore.getState().bonds.find((b) => b.id === bond.id)?.messages ?? []), now);
    try {
      const uri = await generateScenePhoto(buildHisPhotoPrompt(ctx.character, { desc, weatherLine: weatherLine(), timeLine: timeOfDayLine(new Date(now)) }), ctx.character);
      useAppStore.getState().patchMessage({ bondId: bond.id }, id, { imageUri: uri, mediaStatus: undefined });
    } catch (e) {
      console.warn('[his-photo] 照片没洗出来：', e);
      useAppStore.getState().patchMessage({ bondId: bond.id }, id, { mediaStatus: 'failed' });
    }
  },
});
