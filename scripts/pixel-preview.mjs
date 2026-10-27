// 像素贴画预览（D-254）：读 content/pixel-art.ts 里的调色板与点阵，拼一张总览 PNG（每张 4×，白天一组、夜里一组，下面写 id）。
// 不用任何依赖：点阵直接写进 RGBA，自己编 PNG（node:zlib）。
// 用法：node scripts/pixel-preview.mjs [输出路径] [倍数，缺省 4] [只看哪几张，逗号分隔]（输出缺省写到系统临时目录 pixel-preview.png）
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(PROJECT, 'content/pixel-art.ts'), 'utf8');

/** 取出 `export const NAME ... = {…};` 的对象字面量（文件里的数据保持纯字面量，见 content/pixel-art.ts 头注） */
function literal(name) {
  const m = source.match(new RegExp(`export const ${name}\\b[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  if (!m) throw new Error(`没找到 ${name}`);
  return new Function(`return (${m[1]});`)();
}
const PALETTE = literal('PIXEL_PALETTE');
const NIGHT = literal('PIXEL_PALETTE_NIGHT');
const ART = literal('PIXEL_ART');

const SCALE = Number(process.argv[3] ?? 4), CELL = 24 * SCALE + 16, COLS = 7, LABEL = 2, PAD = 16;
const only = process.argv[4]?.split(',');
const ids = Object.keys(ART).filter((id) => !only || only.includes(id));
const rowsPerBlock = Math.ceil(ids.length / COLS);
const cellH = CELL + 18;
const blockH = rowsPerBlock * cellH + PAD;
const W = COLS * CELL + PAD * 2, H = blockH * 2 + PAD;
const img = new Uint8Array(W * H * 4);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function fill(x, y, w, h, hex) {
  const [r, g, b] = rgb(hex);
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) {
      const o = (j * W + i) * 4;
      img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = 255;
    }
}

// 3×5 小字（只要小写字母），每个字 5 行、空格隔开
const FONT = {
  a: '.#. #.# ### #.# #.#', b: '##. #.# ##. #.# ##.', c: '.## #.. #.. #.. .##', d: '##. #.# #.# #.# ##.',
  e: '### #.. ##. #.. ###', f: '### #.. ##. #.. #..', g: '.## #.. #.# #.# .##', h: '#.# #.# ### #.# #.#',
  i: '### .#. .#. .#. ###', j: '..# ..# ..# #.# .#.', k: '#.# #.# ##. #.# #.#', l: '#.. #.. #.. #.. ###',
  m: '#.# ### ### #.# #.#', n: '##. #.# #.# #.# #.#', o: '.#. #.# #.# #.# .#.', p: '##. #.# ##. #.. #..',
  q: '.#. #.# #.# ##. .##', r: '##. #.# ##. #.# #.#', s: '.## #.. .#. ..# ##.', t: '### .#. .#. .#. .#.',
  u: '#.# #.# #.# #.# ###', v: '#.# #.# #.# #.# .#.', w: '#.# #.# ### ### #.#', x: '#.# #.# .#. #.# #.#',
  y: '#.# #.# .#. .#. .#.', z: '### ..# .#. #.. ###',
};
const glyph = (ch) => (FONT[ch] ?? '... ... ... ... ...').replaceAll(' ', '');
function text(str, x, y, hex) {
  [...str].forEach((ch, k) => {
    const g = glyph(ch);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++)
      if (g[j * 3 + i] === '#') fill(x + (k * 4 + i) * LABEL, y + j * LABEL, LABEL, LABEL, hex);
  });
}

function block(top, palette, bg, labelHex) {
  fill(0, top, W, blockH, bg);
  ids.forEach((id, n) => {
    const rows = ART[id];
    const w = rows[0].length * SCALE, h = rows.length * SCALE;
    const cx = PAD + (n % COLS) * CELL, cy = top + PAD + Math.floor(n / COLS) * cellH;
    const ox = cx + (CELL - w) / 2, oy = cy + (CELL - 16 - h) / 2;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') fill(ox + x * SCALE, oy + y * SCALE, SCALE, SCALE, palette[ch] ?? '#FF00FF');
    }));
    text(id, cx + (CELL - id.length * 4 * LABEL) / 2, cy + CELL - 8, labelHex);
  });
}
block(0, PALETTE, '#F6F3F5', '#8C8389');
block(blockH, NIGHT, '#1E1B2B', '#8C8389');

// PNG 编码
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const out = process.argv[2] ?? path.join(process.env.TEMP ?? process.env.TMPDIR ?? '.', 'pixel-preview.png');
fs.writeFileSync(out, png);
console.log(out, `${W}×${H}`, ids.length, 'stickers');
