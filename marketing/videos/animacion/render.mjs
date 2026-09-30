// Render cuadro por cuadro del video animado de Oído. Ver README.md.
// Uso: node render.mjs <video> [fps] [desde] [hasta] [soloCuadros...]
// <video> es el nombre de la escena: lee <video>.html (HTML/CSS) y <video>.js
// (el cuerpo de una función que devuelve seek(t) para lo que no es CSS).
import { createRequire } from "node:module";
import fs from "node:fs";

// Playwright vive en las dependencias del frontend.
const require = createRequire(new URL("../../../frontend/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
process.chdir(new URL(".", import.meta.url).pathname);

const NAME = process.argv[2];
if (!NAME || !fs.existsSync(`${NAME}.html`)) throw new Error("uso: node render.mjs <video> [fps] [desde] [hasta]");
const FPS = Number(process.argv[3] || 30);
const FROM = Number(process.argv[4] || 0);
const TO = Number(process.argv[5] || 22.5);
const ONLY = process.argv.slice(6).map(Number);
const OUT = ONLY.length ? `shots/${NAME}` : `frames/${NAME}`;
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(`${NAME}.html`, "utf8");
const seekSrc = fs.readFileSync(`${NAME}.js`, "utf8");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.goto(`${process.env.APP_URL || "http://localhost:3000"}/terminos`, { waitUntil: "networkidle" });
await page.evaluate((h) => {
  document.body.style.overflow = "hidden";
  const w = document.createElement("div");
  w.innerHTML = h;
  document.body.appendChild(w);
}, html);
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)))));
});
await page.waitForTimeout(400);

await page.evaluate((src) => {
  const stage = document.getElementById("stage");
  const helpers = {
    clamp: (x) => Math.max(0, Math.min(1, x)),
    easeOut: (x) => 1 - Math.pow(1 - x, 3),
    $: (id) => document.getElementById(id),
  };
  const extra = new Function(src)();
  window.seek = (t) => {
    for (const a of stage.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = t * 1000;
    }
    extra(t, helpers);
  };
}, seekSrc);

const times = ONLY.length ? ONLY : [];
if (!ONLY.length) for (let f = Math.round(FROM * FPS); f < Math.round(TO * FPS); f++) times.push(f / FPS);
let i = 0;
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t);
  const name = ONLY.length ? `t_${t}.png` : `${String(i).padStart(4, "0")}.jpg`;
  await page.screenshot({ path: `${OUT}/${name}`, type: ONLY.length ? "png" : "jpeg", quality: ONLY.length ? undefined : 94, clip: { x: 0, y: 0, width: 540, height: 960 } });
  i++;
}
await browser.close();
console.log(`listo: ${times.length} cuadros en ${OUT}/`);
