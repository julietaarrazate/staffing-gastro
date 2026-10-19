// Paso posterior a `opennextjs-cloudflare build` (ver `npm run cf:build`).
//
// 1. Imágenes de vista previa como archivos estáticos. `/og/oido.jpg` y
//    `/twitter-image` se arman en el build (`force-static`), pero el Worker
//    las volvía a ejecutar en cada pedido y fallaban: usan `sharp` (binario
//    nativo) y leen fuentes del disco, y nada de eso existe en Workers. Acá
//    se copia lo que Next ya generó a los assets, que Cloudflare sirve antes
//    de llegar al Worker.
// 2. `_headers`: cabeceras para esos assets estáticos, que no pasan por el
//    `headers()` de `next.config.ts`.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const APP = ".next/server/app";
const ASSETS = ".open-next/assets";

const files = [
  ["og/oido.jpg.body", "og/oido.jpg"],
  ["twitter-image.body", "twitter-image"],
];
for (const [from, to] of files) {
  mkdirSync(dirname(join(ASSETS, to)), { recursive: true });
  copyFileSync(join(APP, from), join(ASSETS, to));
}

writeFileSync(
  join(ASSETS, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/og/oido.jpg
  Cache-Control: public, max-age=3600, must-revalidate

/twitter-image
  Content-Type: image/png
  Cache-Control: public, max-age=3600, must-revalidate
`,
);

console.log("[cf] imágenes de vista previa y _headers copiados a", ASSETS);
