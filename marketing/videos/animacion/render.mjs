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
const ONLY = process.argv.slice(6).map(Number);
const OUT = ONLY.length ? `shots/${NAME}` : `frames/${NAME}`;
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(`${NAME}.html`, "utf8");
const seekSrc = fs.readFileSync(`${NAME}.js`, "utf8");
// Si el video tiene guion (voz en off), la escena lo lee de window.GUION para
// sincronizar los textos con la voz. Ver historia.guion.json.
const guion = fs.existsSync(`${NAME}.guion.json`) ? JSON.parse(fs.readFileSync(`${NAME}.guion.json`, "utf8")) : null;
const TO = Number(process.argv[5] || guion?.duracion || 22.5);
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
await page.evaluate((g) => {
  window.GUION = g;
  if (!g) return;
  // Cada texto con data-v="<id de línea>" se parte en palabras, y cada palabra
  // entra en el momento en que la voz la dice (interpolado por letras dentro
  // de la línea del guion). "|" corta renglón y *palabra* la pinta (clase
  // "acc" sobre fondo oscuro o ámbar —dentro de .oscuro—, "acc2" sobre claro).
  const lineas = Object.fromEntries(g.lineas.map((l) => [l.id, l]));
  const norm = (w) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9ñ]/g, "");
  const ADELANTO = 0.08; // la palabra aparece apenas antes de oírse: se lee a la par
  for (const el of document.querySelectorAll("#stage [data-v]")) {
    const ln = lineas[el.dataset.v];
    const dichas = ln.texto.split(/\s+/);
    const inicio = [];
    let acc = 0;
    for (const w of dichas) { inicio.push(acc); acc += w.length + 1; }
    const tokens = el.textContent.trim().replace(/\|/g, " | ").split(/\s+/);
    const primera = tokens.find((t) => t !== "|").replace(/\*/g, "");
    let j = dichas.findIndex((w) => norm(w) === norm(primera));
    if (j < 0) j = 0;
    el.textContent = "";
    for (const t of tokens) {
      if (t === "|") { el.appendChild(document.createElement("br")); continue; }
      const k = Math.min(j++, dichas.length - 1);
      const sp = document.createElement("span");
      sp.className = t.startsWith("*") ? "w " + (el.closest(".oscuro") ? "acc" : "acc2") : "w";
      sp.textContent = t.replace(/\*/g, "");
      sp.style.animationDelay = `${(ln.at + (ln.dur * inicio[k]) / acc - ADELANTO).toFixed(3)}s`;
      el.append(sp, " ");
    }
  }
}, guion);
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
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t);
  // El número de cuadro es absoluto: `node render.mjs <video> 30 34 35` rehace sólo ese tramo.
  const name = ONLY.length ? `t_${t}.png` : `${String(Math.round(t * FPS)).padStart(4, "0")}.jpg`;
  await page.screenshot({ path: `${OUT}/${name}`, type: ONLY.length ? "png" : "jpeg", quality: ONLY.length ? undefined : 94, clip: { x: 0, y: 0, width: 540, height: 960 } });
}
await browser.close();
console.log(`listo: ${times.length} cuadros en ${OUT}/`);
