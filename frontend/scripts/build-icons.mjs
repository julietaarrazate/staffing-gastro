// Regenera los íconos raster desde los SVG de marca (public/logo-mark.svg y
// public/logo-maskable.svg). Correr a mano después de tocar el logo:
//   node scripts/build-icons.mjs
//
// Existe porque los PNG y el favicon.ico se rasterizaban una vez y se
// commiteaban planos, así que el rebrand al ámbar los dejó con el naranja
// viejo durante semanas (el .ico, además, porque `sharp` no escribe ICO).
// El .ico se arma a mano: un ICO puede contener PNG tal cual (Vista+ y todos
// los navegadores), así que alcanza con un encabezado + un directorio.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const pub = new URL("../public/", import.meta.url);
const mark = await readFile(new URL("logo-mark.svg", pub));
const maskable = await readFile(new URL("logo-maskable.svg", pub));

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

for (const [file, svg, size] of [
  ["icon-192.png", mark, 192],
  ["icon-512.png", mark, 512],
  ["apple-icon.png", mark, 180],
  ["icon-maskable-512.png", maskable, 512],
]) {
  await writeFile(new URL(file, pub), await png(svg, size));
}

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(mark, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reservado
header.writeUInt16LE(1, 2); // tipo 1 = ícono
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); // ancho
  e.writeUInt8(s, 1); // alto
  e.writeUInt8(0, 2); // sin paleta
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); // planos
  e.writeUInt16LE(32, 6); // bits por pixel
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});
await writeFile(new URL("favicon.ico", pub), Buffer.concat([header, ...entries, ...images]));
console.log("íconos regenerados: icon-192/512, apple-icon, icon-maskable-512, favicon.ico (16/32/48)");
