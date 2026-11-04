#!/usr/bin/env node
/**
 * 生成应用图标源图（1024×1024 PNG），供 `tauri icon` 派生出各尺寸图标。
 *
 * 设计：圆角方形苹果蓝底（#007AFF）+ 白色 "A2A" 字样（产品名缩写）。
 * 不依赖任何图形库：手写 SDF 光栅化 + 3×3 超采样抗锯齿 + 手写 PNG 编码。
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIZE = 1024;
const OUT = join(HERE, '..', 'desktop-tauri', 'src-tauri', 'icons', 'source.png');

// ─── PNG 编码 ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── 形状：有符号距离场（SDF），返回 <0 表示在形状内 ──────────

/** 点到线段的最短距离（胶囊体 SDF 的基础） */
function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function sdRoundedRect(px, py, halfW, halfH, radius) {
  const dx = Math.abs(px) - (halfW - radius);
  const dy = Math.abs(py) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function sdCapsule(px, py, ax, ay, bx, by, thickness) {
  return segmentDistance(px, py, ax, ay, bx, by) - thickness;
}

/**
 * "A2A" 字形：全部由胶囊线段拼成，坐标以 [0,1] 为画布
 * （shapeAlpha 里再减去 0.5 归一化）。
 *
 * 三个字符等宽居中：A · 2 · A。笔画粗细统一，转角靠线段端点自然形成
 * 圆角，和蓝底圆角方形的观感一致。
 */
const STROKE = 0.036;       // 笔画半宽
const TOP = 0.30;           // 字符顶部
const BOTTOM = 0.70;        // 字符底部
const CHAR_W = 0.18;        // 单字符宽度
const GAP = 0.10;           // 字符间距
const TOTAL_W = CHAR_W * 3 + GAP * 2;
const START_X = (1 - TOTAL_W) / 2;
const SCALE = 0.94;         // 整体留边，避免贴到圆角
const CENTERS = [
  START_X + CHAR_W / 2,
  START_X + CHAR_W + GAP + CHAR_W / 2,
  START_X + 2 * (CHAR_W + GAP) + CHAR_W / 2,
];

/** 字母 A：两条腿 + 中间横杠 */
function letterA(cx) {
  const apex = [cx, TOP];
  const left = [cx - 0.095, BOTTOM];
  const right = [cx + 0.095, BOTTOM];
  const barY = 0.56;
  const barHalf = 0.095 * (barY - TOP) / (BOTTOM - TOP);
  return [
    [...apex, ...left],
    [...apex, ...right],
    [cx - barHalf, barY, cx + barHalf, barY],
  ];
}

/** 数字 2：顶部圆弧（多段折线近似）+ 右下过渡 + 斜线 + 底横 */
function digit2(cx) {
  const arc = [
    [cx - 0.085, 0.38], [cx - 0.08, 0.34], [cx - 0.055, 0.31],
    [cx - 0.02, 0.30], [cx + 0.02, 0.30], [cx + 0.055, 0.31],
    [cx + 0.08, 0.34], [cx + 0.085, 0.38], [cx + 0.085, 0.42],
  ];
  const strokes = [];
  for (let i = 0; i < arc.length - 1; i++) strokes.push([...arc[i], ...arc[i + 1]]);
  strokes.push([cx + 0.085, 0.42, cx - 0.10, BOTTOM]);   // 斜线
  strokes.push([cx - 0.10, BOTTOM, cx + 0.10, BOTTOM]);  // 底横
  return strokes;
}

const STROKES = [
  ...letterA(CENTERS[0]),
  ...digit2(CENTERS[1]),
  ...letterA(CENTERS[2]),
].map(([ax, ay, bx, by]) => [
  0.5 + (ax - 0.5) * SCALE, 0.5 + (ay - 0.5) * SCALE,
  0.5 + (bx - 0.5) * SCALE, 0.5 + (by - 0.5) * SCALE,
]);

/** 底为圆角方形，前景为 "A2A"；坐标已归一化到 [-0.5, 0.5] */
function shapeAlpha(nx, ny) {
  const insideRect = sdRoundedRect(nx, ny, 0.5, 0.5, 0.225);
  let glyph = Infinity;
  for (const [ax, ay, bx, by] of STROKES) {
    glyph = Math.min(glyph, sdCapsule(nx, ny, ax - 0.5, ay - 0.5, bx - 0.5, by - 0.5, STROKE));
  }
  return { rect: insideRect, arrow: glyph };
}

// ─── 光栅化（3×3 超采样）────────────────────────────────────

const SS = 3;

/** 线性插值：把纯白文字按覆盖率混到纯色底上 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 把一块画布光栅化成 RGBA 像素。
 *
 * `shape` 收归一化坐标（[-0.5, 0.5]），返回 `{ rect, arrow }` 两个 SDF 值。
 * 分成「底」与「文字」两层是为了让两者各自带抗锯齿覆盖率 —— 文字压在底上，
 * 边缘不能直接取整。
 */
function rasterize(size, shape) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rectHits = 0;
      let arrowHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size - 0.5;
          const py = (y + (sy + 0.5) / SS) / size - 0.5;
          const { rect, arrow } = shape(px, py);
          if (rect <= 0) rectHits++;
          if (arrow <= 0) arrowHits++;
        }
      }
      const total = SS * SS;
      const rectA = rectHits / total;
      const arrowA = arrowHits / total;
      if (rectA === 0) continue;

      // 底色：纯苹果蓝 #007AFF，在浅色/深色壁纸和 Dock 里都保持同一个品牌蓝。
      let r = 0x00;
      let g = 0x7a;
      let b = 0xff;
      // 文字为纯白，按覆盖率与底色混合
      if (arrowA > 0) {
        r = lerp(r, 255, arrowA);
        g = lerp(g, 255, arrowA);
        b = lerp(b, 255, arrowA);
      }
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
      pixels[i + 3] = Math.round(rectA * 255);
    }
  }
  return pixels;
}

const pixels = rasterize(SIZE, shapeAlpha);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(SIZE, SIZE, pixels));
console.log(`[icon] 已生成 ${OUT}`);

// ─── PWA 普通图标（180 / 192 / 512）──────────────────────────
// 与 source.png 同一套形状（带圆角、透明四角），只是尺寸不同。
// maskable 那一档单独生成，见下。
for (const size of [180, 192, 512]) {
  const out = join(HERE, '..', 'desktop-tauri', 'ui', 'assets', `app-icon-${size}.png`);
  writeFileSync(out, encodePng(size, size, rasterize(size, shapeAlpha)));
  console.log(`[icon] 已生成 ${out}`);
}

// ─── PWA maskable 图标 ──────────────────────────────────────
//
// 「maskable」是 Android 自适应图标用的那一档：系统会**按自己的形状裁剪**
// （圆形、方形、水滴…），并可能把图形放大到 1.33 倍。规范要求关键内容落在
// 中心 80% 直径的圆内，否则会被裁掉。
//
// 所以这一版与 source.png 有两处必须不同，不能直接复用同一张图：
//   ① **满铺、不透明、无圆角** —— 带透明圆角的图被裁成圆形后，四角会露出
//      底色（黑边），且规范明确要求 maskable 图标不能有透明像素；
//   ② **文字缩到 72%** —— 留出被裁剪的余量，放大 1.33 倍后仍完整。
//
// 输出直接落到 `ui/assets/`（手机端静态资源目录），不进 tauri icons ——
// 那一套是桌面端安装包用的，与 PWA 无关。
const MASKABLE_OUT = join(HERE, '..', 'desktop-tauri', 'ui', 'assets', 'app-icon-maskable-512.png');
const MASKABLE_SIZE = 512;
/** 文字缩放：0.72 时文字横向跨度约 0.53，落在 80% 安全圆内 */
const MASKABLE_SCALE = 0.72;

const maskablePixels = rasterize(MASKABLE_SIZE, (nx, ny) => {
  // 底：满铺整块画布（SDF 恒 <0），于是没有透明像素、也没有圆角
  const rect = -1;
  // 文字：坐标放大 = 图形缩小，居中不变
  const { arrow } = shapeAlpha(nx / MASKABLE_SCALE, ny / MASKABLE_SCALE);
  return { rect, arrow };
});

writeFileSync(MASKABLE_OUT, encodePng(MASKABLE_SIZE, MASKABLE_SIZE, maskablePixels));
console.log(`[icon] 已生成 ${MASKABLE_OUT}`);
