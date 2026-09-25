import fs from "node:fs";
import zlib from "node:zlib";

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPngRgba(buf) {
  if (buf.length < 8 || buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("not a png");
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const idats = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png type=${colorType} depth=${depth}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = Buffer.alloc(stride);
    raw.copy(row, 0, src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let recon = row[i];
      if (filter === 1) recon = (recon + left) & 255;
      else if (filter === 2) recon = (recon + up) & 255;
      else if (filter === 3) recon = (recon + ((left + up) >> 1)) & 255;
      else if (filter === 4) recon = (recon + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`bad png filter ${filter}`);
      row[i] = recon;
    }
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      const si = x * bpp;
      rgba[di] = row[si];
      rgba[di + 1] = row[si + 1];
      rgba[di + 2] = row[si + 2];
      rgba[di + 3] = bpp === 4 ? row[si + 3] : 255;
    }
    prev = row;
  }
  return { width, height, rgba };
}

function writePngRgba(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[(stride + 1) * y] = 0;
    rgba.copy(raw, (stride + 1) * y + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  function pushChunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    chunks.push(head, body, crc);
  }
  pushChunk("IHDR", ihdr);
  pushChunk("IDAT", zlib.deflateSync(raw, { level: 9 }));
  pushChunk("IEND", Buffer.alloc(0));
  return Buffer.concat(chunks);
}

export function knockOutDarkPngBackground(buf) {
  const { width, height, rgba } = readPngRgba(buf);
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const i of corners) {
    br += rgba[i];
    bg += rgba[i + 1];
    bb += rgba[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;
  const bgLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
  if (bgLum > 80) return buf;
  const floor = Math.max(bgLum + 28, 48);
  const span = Math.max(1, 255 - floor);
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    const alpha = Math.max(0, Math.min(255, Math.round(((lum - floor) / span) * 255)));
    rgba[i + 3] = Math.min(rgba[i + 3], alpha);
    if (rgba[i + 3] === 0) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
    } else {
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
    }
  }
  return writePngRgba(width, height, rgba);
}

export function knockOutLockup(lockupPath = "public/orbit-command-center.png") {
  if (!fs.existsSync(lockupPath)) return;
  const next = knockOutDarkPngBackground(fs.readFileSync(lockupPath));
  fs.writeFileSync(lockupPath, next);
  console.log(`knocked out dark background on ${lockupPath} (${next.length} bytes)`);
}
