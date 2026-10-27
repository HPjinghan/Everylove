/**
 * 像素贴画（D-254）：按 id 把 content/pixel-art.ts 的点阵画成 SVG。
 * viewBox = 点阵的格数，所以 size 随便给都是整格放大；同一行里相邻的同色格并成一个 Rect（一张图几十个元素，不是几百个）。
 * night = 换夜里调色板：除了灯、窗、招牌、屏幕这些光源，其余都压暗偏蓝。没有这个 id 就什么都不画。
 * 每个 Rect 往右、往下多出一丝，盖住非整数缩放时格与格之间的发丝缝（后画的会盖在上面，不改变图）。
 */

import Svg, { Rect } from 'react-native-svg';

import { PIXEL_ART, PIXEL_PALETTE, PIXEL_PALETTE_NIGHT } from '@/content/pixel-art';

type Run = { x: number; y: number; w: number; fill: string };
type Sheet = { cols: number; rows: number; runs: Run[] };

/** 盖缝用的一丝（viewBox 单位） */
const BLEED = 0.04;

const cache = new Map<string, Sheet | null>();

/** 点阵 → 同色横向连续段；按 id + 昼夜缓存在模块里，数据是静态的 */
function sheetFor(id: string, night: boolean): Sheet | null {
  const key = `${id}|${night ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const art = PIXEL_ART[id];
  let sheet: Sheet | null = null;
  if (art?.length) {
    const palette = night ? PIXEL_PALETTE_NIGHT : PIXEL_PALETTE;
    const runs: Run[] = [];
    art.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        let end = x + 1;
        while (end < row.length && row[end] === ch) end++;
        const fill = palette[ch];
        if (ch !== '.' && fill) runs.push({ x, y, w: end - x, fill });
        x = end;
      }
    });
    sheet = { cols: Math.max(...art.map((r) => r.length)), rows: art.length, runs };
  }
  cache.set(key, sheet);
  return sheet;
}

export function PixelArt({ id, size, night }: { id: string; size: number; night?: boolean }) {
  const sheet = sheetFor(id, !!night);
  if (!sheet) return null;
  const { cols, rows, runs } = sheet;
  return (
    <Svg
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      // crispEdges 只在 web 生效（类型里没有这个属性）；原生靠上面的 BLEED 盖缝
      {...({ shapeRendering: 'crispEdges' } as object)}
    >
      {runs.map((r) => (
        <Rect
          key={`${r.x},${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w + BLEED}
          height={1 + BLEED}
          fill={r.fill}
        />
      ))}
    </Svg>
  );
}
