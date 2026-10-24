// ringring app logo：两个方 r（ringring 的 rr）+ 一颗心 + 两边的震动线（D-228）。SVG → PNG（resvg），不用字体，字母全是几何拼的。
import fs from 'node:fs';
import path from 'node:path';
// 依赖不进 package.json，只在出图时装：npm i --no-save @resvg/resvg-js@2 && node scripts/logo/render.mjs
// eslint-disable-next-line import/no-unresolved -- 出图时临时安装，不进 package.json
import { Resvg } from '@resvg/resvg-js';

import { fileURLToPath } from 'node:url';
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(PROJECT, 'assets/images');

// THEMES.paper
const paper = '#FFD6E7', primary = '#E8578A', ink = '#4A2B36', surface = '#FFFFFF';
// MingCute heart（components/mingcute.tsx）
const HEART = 'M18.4938 3.801C20.5893 5.0219 22.0628 7.50064 21.9979 10.3928C21.861 16.4997 13.5 20.9997 12 20.9997C10.5 20.9997 2.13902 16.4997 2.00206 10.3928C1.9372 7.50064 3.41065 5.0219 5.50615 3.801C7.46612 2.65907 9.92814 2.65295 12 4.33823C14.0719 2.65295 16.5339 2.65907 18.4938 3.801Z';
const heart = (cx, cy, size, fill, rot = 0) =>
  `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${size / 20}) translate(-12 -11.8)"><path d="${HEART}" fill="${fill}"/></g>`;

/** 方 r：竖杆 + 横肩，外角圆角 rc、内角 ri；x / y 为左上角（1024 画布） */
const R = { w: 140, h: 380, W: 300, t: 140, rc: 70, ri: 30 };
const squareR = (x, y, fill) =>
  `<path d="M${x} ${y + R.h} V${y + R.rc} A${R.rc} ${R.rc} 0 0 1 ${x + R.rc} ${y} H${x + R.W} V${y + R.t} H${x + R.w + R.ri} A${R.ri} ${R.ri} 0 0 0 ${x + R.w} ${y + R.t + R.ri} V${y + R.h} Z" fill="${fill}"/>`;

/** 震动线：左右各两道斜短杠 */
const ticks = (cx, cy, half, color, w) =>
  [-1, 1].map((side) => [0, 1].map((k) => {
    const x = cx + side * (half + k * 62);
    return `<path d="M${x - side * 14} ${cy - 70 - k * 22} L${x + side * 14} ${cy + 70 + k * 22}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" transform="rotate(${side * -12} ${x} ${cy})"/>`;
  }).join('')).join('');

/** 标志本体：rr + 心 + 震动线，整体左倾 6°，居中在 1024 画布 */
function mark({ letters, heartFill, tickFill }) {
  const gap = 44, y = 400, x = 512 - (2 * R.W + gap) / 2;
  return `<g transform="rotate(-6 512 512)">
    ${squareR(x, y, letters)}${squareR(x + R.W + gap, y, letters)}
    ${heart(512, 275, 160, heartFill, 10)}
    ${ticks(512, 600, 365, tickFill, 26)}
  </g>`;
}

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;

/** App 图标：墨色底、白字、粉心粉线 */
const iconSvg = () => svg(`<rect width="1024" height="1024" fill="${ink}"/>${mark({ letters: surface, heartFill: primary, tickFill: primary })}`);
/** 启动页图：透明底（底色是 app.json 里的纸面粉），墨字粉心 */
const splashSvg = () => svg(mark({ letters: ink, heartFill: primary, tickFill: primary }));

function render(source, width, file) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();
  fs.writeFileSync(file, png);
  console.log(path.basename(file), width, png.length, 'bytes');
}

const scratch = process.env.TEMP ?? process.env.TMPDIR ?? '.';
render(iconSvg(), 1024, path.join(OUT, 'icon.png'));
render(iconSvg(), 96, path.join(OUT, 'favicon.png'));
render(splashSvg(), 600, path.join(OUT, 'splash-icon.png'));
// 启动页预览：纸面粉底上看一眼
render(svg(`<rect width="1024" height="1024" fill="${paper}"/>${mark({ letters: ink, heartFill: primary, tickFill: primary })}`), 256, path.join(scratch, 'splash-preview.png'));
