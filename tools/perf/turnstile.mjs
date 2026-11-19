#!/usr/bin/env node
// Cuánto tarda el tilde de Cloudflare Turnstile en el ingreso (antes/después).
//
// Mide dos caminos, con CPU x4 y red de celular como `medir.mjs`:
//   - "desde la landing": abrir `/`, quedarse 3 s, tocar «Entrar» y esperar a
//     que el botón «Ingresar» se habilite (eso pasa cuando llega el token);
//   - "directo": abrir `/login` en frío y esperar lo mismo.
// Y desglosa: cuándo terminó de bajar el script de Turnstile, cuándo cargó
// su iframe y cuándo llegó el token, contados desde el toque (o desde la
// navegación, en el directo).
//
// Requiere un build con la clave de PRUEBA de Turnstile (siempre aprueba, la
// publica Cloudflare para tests; no es secreta):
//   cd frontend && NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
//   npx next start -p 3200 &
//   node tools/perf/turnstile.mjs --base http://localhost:3200 --runs 5 [--out x.json]
// Este script sí deja salir los pedidos a challenges.cloudflare.com; la API
// de Oído se simula igual que en `medir.mjs`.

import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

let chromium;
try {
  ({ chromium } = createRequire(new URL("../../frontend/package.json", import.meta.url))("playwright"));
} catch {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
}

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = arg("base", "http://localhost:3200");
const RUNS = Number(arg("runs", "5"));
const OUT = arg("out");

async function run(browser, camino) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript(() => sessionStorage.setItem("staffya_splash_seen", "1"));
  await page.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.includes("/api/v1/"),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "challenges.cloudflare.com") return route.continue();
      if (url.pathname.includes("/api/v1/")) {
        // Sin sesión: /auth/refresh y /auth/me contestan 401.
        const status = /\/auth\/(refresh|me)$/.test(url.pathname) ? 401 : 200;
        return route.fulfill({ status, contentType: "application/json", body: status === 401 ? '{"detail":"no"}' : "[]" });
      }
      return route.abort();
    },
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });

  let iframeAt = null;
  page.on("framenavigated", (f) => {
    if (iframeAt === null && f !== page.mainFrame() && f.url().includes("challenges.cloudflare.com")) iframeAt = Date.now();
  });

  let t0;
  if (camino === "landing") {
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);
    const entrar = page.locator('a[href="/login"]').first();
    t0 = Date.now();
    await entrar.tap();
  } else {
    t0 = Date.now();
    await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  }
  const boton = page.getByRole("button", { name: "Ingresar", exact: true });
  await boton.waitFor({ timeout: 60_000 });
  const formAt = Date.now();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Ingresar");
    return b && !b.disabled;
  }, null, { timeout: 60_000, polling: 50 });
  const tokenAt = Date.now();
  // Fin de la descarga del script (la de `api.js` y la del archivo versionado
  // al que redirige), en reloj de pared.
  const scriptAt = await page.evaluate(() => {
    const e = performance.getEntriesByType("resource").filter((r) => r.name.includes("challenges.cloudflare.com") && r.name.includes("api.js"));
    return e.length ? performance.timeOrigin + Math.max(...e.map((r) => r.responseEnd)) : null;
  });
  await context.close();
  const rel = (t) => (t === null ? null : Math.round(t - t0));
  return { formulario: rel(formAt), script: rel(scriptAt), iframe: rel(iframeAt), tilde: rel(tokenAt) };
}

const median = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

const LOCAL = process.env.PW_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(LOCAL) ? { executablePath: LOCAL } : {});
const out = { base: BASE, runs: RUNS, date: new Date().toISOString() };
for (const camino of ["landing", "directo"]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await run(browser, camino));
  const m = (k) => median(runs.map((r) => r[k]));
  out[camino] = { formulario: m("formulario"), script: m("script"), iframe: m("iframe"), tilde: m("tilde"), corridas: runs };
  console.log(`${camino.padEnd(8)} formulario ${m("formulario")} ms · script listo ${m("script")} ms · iframe ${m("iframe")} ms · tilde ${m("tilde")} ms (mediana de ${RUNS})`);
}
await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
