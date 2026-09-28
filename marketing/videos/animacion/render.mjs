// Render cuadro por cuadro del video animado de Oído. Ver README.md.
// Uso: node render.mjs [fps] [desde] [hasta] [soloCuadros...]
import { createRequire } from "node:module";
import fs from "node:fs";

// Playwright vive en las dependencias del frontend.
const require = createRequire(new URL("../../../frontend/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
process.chdir(new URL(".", import.meta.url).pathname);

const FPS = Number(process.argv[2] || 30);
const FROM = Number(process.argv[3] || 0);
const TO = Number(process.argv[4] || 22);
const ONLY = process.argv.slice(5).map(Number);
const OUT = ONLY.length ? "shots" : "frames";
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync("stage.html", "utf8");
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

await page.evaluate(() => {
  const stage = document.getElementById("stage");
  const typedFull = "Necesito un mozo hoy de 21 a 2, pago 45.000";
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  window.seek = (t) => {
    for (const a of stage.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = t * 1000;
    }
    const n = Math.round(clamp((t - 6.55) / 1.45) * typedFull.length);
    document.getElementById("typed").textContent = typedFull.slice(0, n);
    const typing = t > 6.55 && t < 8.0;
    document.getElementById("caret").style.opacity = t > 6.3 && t < 8.3 && (typing || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
    const c = t < 12.95 ? 1 : t < 13.45 ? 2 : 3;
    document.getElementById("count").textContent = c;
    document.getElementById("countLabel").textContent = c === 1 ? "postulante" : "postulantes";
    const secs = Math.round(easeOut(clamp((t - 15.35) / 1.4)) * 462);
    document.getElementById("timer").textContent =
      String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0");
  };
});

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
