// Everylove app logo：纸面设计系统的 token 画一部小手机（D-103）。SVG → PNG（resvg），字标用 Fredoka 600。
import fs from 'node:fs';
import path from 'node:path';
// 依赖不进 package.json，只在出图时装：npm i --no-save @resvg/resvg-js@2 && node scripts/logo/render.mjs
// eslint-disable-next-line import/no-unresolved -- 出图时临时安装，不进 package.json
import { Resvg } from '@resvg/resvg-js';

import { fileURLToPath } from 'node:url';
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FONT = path.join(PROJECT, 'node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf');
const OUT = path.join(PROJECT, 'assets/images');

// THEMES.paper
const paper = '#FFD6E7', primary = '#E8578A', accent = '#C2185B', ink = '#4A2B36', surface = '#FFFFFF', chatPaper = '#FBE4EC';
// MingCute heart（components/mingcute.tsx）
const HEART = 'M18.4938 3.801C20.5893 5.0219 22.0628 7.50064 21.9979 10.3928C21.861 16.4997 13.5 20.9997 12 20.9997C10.5 20.9997 2.13902 16.4997 2.00206 10.3928C1.9372 7.50064 3.41065 5.0219 5.50615 3.801C7.46612 2.65907 9.92814 2.65295 12 4.33823C14.0719 2.65295 16.5339 2.65907 18.4938 3.801Z';

/** 菱格暗纹：设计稿 14px 线距 ×（1024/390）≈ 37；正方形单元边 37√2 */
function diamond(id, color, alpha, cell = 37, w = 2.6) {
  const s = cell * Math.SQRT2;
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${s}" height="${s}">
    <line x1="0" y1="0" x2="${s}" y2="${s}" stroke="${color}" stroke-opacity="${alpha}" stroke-width="${w}"/>
    <line x1="0" y1="${s}" x2="${s}" y2="0" stroke="${color}" stroke-opacity="${alpha}" stroke-width="${w}"/>
  </pattern>`;
}

/** 四角小星（sparkle） */
function sparkle(cx, cy, r, color) {
  const q = r * 0.28;
  return `<path fill="${color}" d="M${cx} ${cy - r} Q${cx + q} ${cy - q} ${cx + r} ${cy} Q${cx + q} ${cy + q} ${cx} ${cy + r} Q${cx - q} ${cy + q} ${cx - r} ${cy} Q${cx - q} ${cy - q} ${cx} ${cy - r}Z"/>`;
}

/**
 * 手机 + 心：以 (cx, top) 为基准，宽 w、高 h。
 * 壳：白底、墨色描边、大圆角；屏：chat paper 底 + 更淡的菱格；灵动岛与 home 条：墨色；心：primary 底 + 墨描边 + 白高光。
 */
function phone(cx, top, w, h, stroke) {
  const x = cx - w / 2;
  const rShell = Math.round(w * 0.17);
  const inset = Math.round(w * 0.06);
  const sx = x + inset, sy = top + inset, sw = w - inset * 2, sh = h - inset * 2, rScreen = Math.round(rShell * 0.72);
  const islandW = Math.round(w * 0.3), islandH = Math.round(w * 0.075);
  const homeW = Math.round(w * 0.32), homeH = Math.round(w * 0.024);
  const heartSize = Math.round(sw * 0.62);
  const scale = heartSize / 24;
  const hx = cx - heartSize / 2, hy = sy + sh * 0.5 - heartSize / 2 + islandH * 0.4;
  const hlR = heartSize * 0.07;
  return `
    <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${rShell}" fill="${surface}" stroke="${ink}" stroke-width="${stroke}"/>
    <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${rScreen}" fill="${chatPaper}"/>
    <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${rScreen}" fill="url(#screenDots)"/>
    <rect x="${cx - islandW / 2}" y="${sy + islandH * 0.9}" width="${islandW}" height="${islandH}" rx="${islandH / 2}" fill="${ink}"/>
    <g transform="translate(${hx} ${hy}) scale(${scale})">
      <path d="${HEART}" fill="${primary}" stroke="${ink}" stroke-width="${stroke / scale}" stroke-linejoin="round"/>
    </g>
    <ellipse cx="${hx + heartSize * 0.33}" cy="${hy + heartSize * 0.36}" rx="${hlR * 1.6}" ry="${hlR}" fill="${surface}" opacity="0.85" transform="rotate(-25 ${hx + heartSize * 0.33} ${hy + heartSize * 0.36})"/>
    <rect x="${cx - homeW / 2}" y="${sy + sh - homeH * 2.6}" width="${homeW}" height="${homeH}" rx="${homeH / 2}" fill="${ink}"/>`;
}

function iconSvg({ size = 1024, wordmark = true, background = true } = {}) {
  const stroke = Math.round(size * 0.0098);
  // 有字标：手机偏上；无字标：居中
  const pw = Math.round(size * (wordmark ? 0.36 : 0.44));
  const ph = Math.round(pw * 1.78);
  const top = wordmark ? Math.round(size * 0.1) : Math.round((size - ph) / 2);
  const cx = size / 2;
  const fontSize = Math.round(size * 0.118);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    ${diamond('bgDots', accent, 0.07, size * 0.036, size * 0.0025)}
    ${diamond('screenDots', accent, 0.05, size * 0.022, size * 0.0016)}
  </defs>
  ${background ? `<rect width="${size}" height="${size}" fill="${paper}"/><rect width="${size}" height="${size}" fill="url(#bgDots)"/>` : ''}
  ${sparkle(cx + pw * 0.62, top + ph * 0.12, size * 0.034, accent)}
  ${sparkle(cx - pw * 0.66, top + ph * 0.7, size * 0.024, primary)}
  ${sparkle(cx + pw * 0.7, top + ph * 0.62, size * 0.016, primary)}
  ${phone(cx, top, pw, ph, stroke)}
  ${wordmark ? `<text x="${cx}" y="${Math.round(size * 0.905)}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="${fontSize}" letter-spacing="${-fontSize * 0.02}" fill="${ink}">everylove</text>` : ''}
</svg>`;
}

/** 启动页图：透明底，只有手机与心（expo-splash-screen 按宽 200 居中） */
function splashSvg() {
  const w = 600, h = 1000;
  const stroke = 10;
  const pw = 440, ph = Math.round(pw * 1.78);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${diamond('screenDots', accent, 0.05, 22, 1.6)}</defs>
  ${sparkle(w / 2 + pw * 0.62, (h - ph) / 2 + ph * 0.12, 34, accent)}
  ${sparkle(w / 2 - pw * 0.66, (h - ph) / 2 + ph * 0.7, 24, primary)}
  ${phone(w / 2, (h - ph) / 2, pw, ph, stroke)}
</svg>`;
}

function render(svg, width, file) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' } });
  const png = r.render().asPng();
  fs.writeFileSync(file, png);
  console.log(path.basename(file), width, png.length, 'bytes');
}

const scratch = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(scratch, 'icon.svg'), iconSvg());
render(iconSvg(), 1024, path.join(OUT, 'icon.png'));
render(iconSvg({ wordmark: false }), 96, path.join(OUT, 'favicon.png'));
render(splashSvg(), 600, path.join(OUT, 'splash-icon.png'));
render(iconSvg(), 256, path.join(scratch, 'icon-preview.png'));
