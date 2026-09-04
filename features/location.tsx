/**
 * 位置（D-081/D-084）：真实地图选点（components/location-picker.tsx），卡片带坐标与一小块地图。
 * 一个玩法一个文件：卡片种类 + 她发出时的动作。
 */

import { CardMap, CardShell } from '@/components/card-bubble';
import type { PickedLocation } from '@/components/location-picker';
import { cardKinds } from '@/core/cards';
import { sendCard, type TurnUi } from '@/core/turn';
import { t } from '@/lib/i18n';

cardKinds.register({
  type: 'location',
  contextText: (c) => `（她发来了自己的位置：${c.title}${c.subtitle ? `，${c.subtitle}` : ''}）`,
  render: (c, dark) => (
    <CardShell
      emoji="📍"
      kicker={t('位置')}
      title={c.title}
      subtitle={c.subtitle}
      dark={dark}
      top={c.lat != null && c.lon != null ? <CardMap lat={c.lat} lon={c.lon} /> : undefined}
    />
  ),
});

/** 她发位置：卡片带经纬度上屏 → TA 回一句 */
export async function sendLocation(bondId: string, loc: PickedLocation, ui?: TurnUi): Promise<void> {
  await sendCard(
    { mode: 'bonded', bondId },
    { type: 'location', title: loc.title, subtitle: loc.subtitle, lat: loc.lat, lon: loc.lon },
    `（她发来了自己的位置：${loc.title}${loc.subtitle ? `，${loc.subtitle}` : ''}。）`,
    ui
  );
}
