// Regenera los íconos raster desde los SVG de marca. Correr a mano después de
// tocar el logo:
//   node scripts/build-icons.mjs
//
// Existe porque los PNG y el favicon.ico se rasterizaban una vez y se
// commiteaban planos, así que el rebrand al ámbar los dejó con el naranja
// viejo durante semanas (el .ico, además, porque `sharp` no escribe ICO).
// El .ico se arma a mano: un ICO puede contener PNG tal cual (Vista+ y todos
// los navegadores), así que alcanza con un encabezado + un directorio.
// Desde el 2026-11-18 el ícono es el pinche con «oído»: la comanda clavada en
// el pinche, con relieve y la palabra en los grandes (logo-mark.svg), plana y
// con la «o» sola en el favicon (logo-mark-chico.svg: a 16–48 px el relieve
// se empasta) y en silueta blanca con la «o» calada para el badge de las
// notificaciones de Android (logo-figure.svg: Android usa sólo el alfa).
// Los SVG (letra ya convertida a trazos) los escribe
// `python3 scripts/build-isotipo-pinche.py`; este script sólo los rasteriza.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const pub = new URL("../public/", import.meta.url);
const mark = await readFile(new URL("logo-mark.svg", pub));
const chico = await readFile(new URL("logo-mark-chico.svg", pub));
const maskable = await readFile(new URL("logo-maskable.svg", pub));
const silueta = await readFile(new URL("logo-figure.svg", pub));

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

for (const [file, svg, size] of [
  ["icon-192.png", mark, 192],
  ["icon-512.png", mark, 512],
  ["apple-icon.png", mark, 180],
  ["icon-maskable-512.png", maskable, 512],
  ["badge-96.png", silueta, 96],
]) {
  await writeFile(new URL(file, pub), await png(svg, size));
}

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(chico, s)));
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

// Las dos imágenes de los mails: la plantilla
// (`backend/app/modules/notification/domain/email_templates.py`) las pide a
// `https://www.oido.com.ar/mail/…`. Van como PNG porque Gmail no muestra SVG,
// ni en línea ni como `<img>`: hasta el 2026-11-28 el logo del mail era un
// SVG en línea y además era el ícono anterior. Se muestran a 56 px (el ícono
// de la app, el mismo de icon-192: Julieta, 2026-11-28, «el ícono que va es
// la miniatura de la app»; el chico con la «o» sola no) y a 26 px de alto (la
// palabra plana en azul hondo); salen al triple para pantallas densas.
await mkdir(new URL("mail/", pub), { recursive: true });
const palabra = await readFile(new URL("../../docs/design-system/marca/oido-plano.svg", import.meta.url));
await writeFile(new URL("mail/pinche.png", pub), await png(mark, 168));
await writeFile(
  new URL("mail/oido.png", pub),
  await sharp(palabra, { density: 384 }).resize({ height: 78 }).png().toBuffer(),
);

console.log(
  "íconos regenerados: icon-192/512, apple-icon, icon-maskable-512, badge-96, favicon.ico (16/32/48), mail/pinche.png, mail/oido.png",
);
