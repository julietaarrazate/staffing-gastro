#!/usr/bin/env node
// Medidor de rendimiento del frontend (antes/después de cada optimización).
//
// Corre contra un `next start` ya levantado (no lo levanta él) con TODA la API
// simulada: ningún pedido sale del contenedor. Por escenario mide, en frío
// (contexto nuevo, sin caché):
//   - bytes de JS, CSS, fuentes e imágenes (transferidos y descomprimidos),
//   - pedidos a la API y cuántos se repiten (mismo método + URL),
//   - FCP, LCP, TBT aproximado y CLS con CPU x4 y red de celular (perfil
//     "mobile" de Lighthouse: 150 ms de RTT, 1,6 Mb/s),
//   - tiempo de script del hilo principal (CDP Performance.getMetrics),
//   - renders de componentes de React, contados con un gancho de DevTools
//     falso: al cargar y en 10 s quietos (lo que se renderiza sin que nadie
//     toque nada es render innecesario).
//
// Uso:
//   cd frontend && npm run build && npx next start -p 3200 &
//   node tools/perf/medir.mjs --base http://localhost:3200 --runs 3 \
//     --out /ruta/antes.json [--only feed,panel] [--no-throttle]
//   node tools/perf/medir.mjs --compare antes.json despues.json
//
// Para ver los nombres de los componentes en "más renderizados", buildear con
// `npx next build --no-mangling` (si no, salen minificados).
// Detalle y resultados: docs/reference/RENDIMIENTO.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// Playwright del frontend (lo trae @playwright/test); si no está, el global.
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
const flag = (name) => args.includes(`--${name}`);

if (flag("compare")) {
  const [a, b] = args.filter((x) => !x.startsWith("--"));
  compare(JSON.parse(readFileSync(a, "utf8")), JSON.parse(readFileSync(b, "utf8")));
  process.exit(0);
}

const BASE = arg("base", "http://localhost:3200");
const RUNS = Number(arg("runs", "3"));
const OUT = arg("out");
const ONLY = arg("only")?.split(",");
const THROTTLE = !flag("no-throttle");
const IDLE_MS = Number(arg("idle", "10000"));

// ---------------------------------------------------------------- datos falsos

const dia = (dias, hora) => {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    new Date(Date.now() + dias * 864e5),
  );
  return `${d}T${hora}:00-03:00`;
};
const PUESTOS = ["mozo", "bartender", "cocinero", "barista", "runner", "cajero"];
const turno = (i, extra = {}) => ({
  id: `s${i}`,
  company_id: `c${i % 4}`,
  position: PUESTOS[i % PUESTOS.length],
  quantity: 1,
  start_at: dia(i % 5, "21:00"),
  end_at: dia((i % 5) + 1, "02:00"),
  pay_amount: String(15000 + i * 500),
  currency: "ARS",
  tips: i % 2 === 0,
  meal: false,
  dress_code: null,
  urgent: i % 7 === 0,
  address: null,
  city: "Palermo, CABA",
  latitude: -34.5875 + i * 0.002,
  longitude: -58.4257 + i * 0.002,
  title: null,
  description: "Servicio de cena, salón de 40 cubiertos.",
  status: "publicado",
  worker_profile_id: null,
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_at: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_at: null,
  paid_at: null,
  created_at: "2026-07-01T12:00:00-03:00",
  company_name: `Bar ${i}`,
  company_logo_url: null,
  distance_km: 0.5 + i * 0.3,
  ...extra,
});
const WORKER = { id: "user-1", email: "w@oido.test", full_name: "Sofía Demo", role: "worker", status: "activo", is_active: true, is_verified: true };
const EMPLOYER = { id: "user-2", email: "e@oido.test", full_name: "Julieta Demo", role: "employer", status: "activo", is_active: true, is_verified: true };
const WORKER_PROFILE = {
  id: "profile-1", user_id: "user-1", full_name: "Sofía Demo", photo_url: null, city: "Palermo, CABA",
  latitude: -34.5875, longitude: -58.4257, skills: ["mozo"], languages: [], certifications: [], is_available: true,
  rating: 4.8, events_completed: 10, punctuality_rate: 0.95, cancellations: 0, badges: [], level: "plata",
};
const COMPANY_PROFILE = {
  id: "c0", user_id: "user-2", name: "Bar Lavalle", logo_url: null, category: "bar", description: null,
  address: "Lavalle 1000", city: "Palermo, CABA", latitude: -34.5875, longitude: -58.4257, capacity: 40,
  opening_hours: null, rating: 4.7, events_published: 12, on_time_payment_rate: 1, payments_recorded: 3, late_cancellations: 0,
};
const FEED = Array.from({ length: 20 }, (_, i) => turno(i + 1));
const MIOS = ["confirmado", "en_camino", "asignado", "finalizado", "pagado", "cancelado", "confirmado", "pagado"].map((status, i) =>
  turno(i + 1, { status, worker_profile_id: "profile-1" }),
);
const PANEL = ["publicado", "publicado", "asignado", "confirmado", "en_curso", "finalizado", "pagado", "pagado", "cancelado", "publicado", "confirmado", "finalizado"].map(
  (status, i) => turno(i + 1, { status, company_id: "c0", company_name: "Bar Lavalle", worker_profile_id: status === "publicado" || status === "cancelado" ? null : "wp1" }),
);

// Respuestas por ruta de la API (GET). Lo que no está acá devuelve [] como en
// los specs E2E; POST/PUT/DELETE devuelven {}.
function apiResponse(role, path) {
  if (path === "/auth/me") return role === "employer" ? EMPLOYER : WORKER;
  if (path === "/workers/me/profile") return WORKER_PROFILE;
  if (path === "/companies/me/profile") return COMPANY_PROFILE;
  if (path.startsWith("/shifts/feed")) return FEED;
  if (path === "/shifts/mine") return MIOS;
  if (path === "/shifts/me") return PANEL;
  if (path === "/identity/me") return { claims: [] };
  if (path === "/notifications/unread-count") return { count: 0 };
  return [];
}

// Toque sin esperar "accionable" (alcanza con que el botón exista): lo que se
// mide son los renders que dispara el onClick, no el scroll ni las capas.
const tap = (locator) => locator.dispatchEvent("click");

const SCENARIOS = [
  { name: "landing", path: "/", role: null },
  { name: "feed", path: "/feed", role: "worker", interact: async (page) => { await tap(page.getByRole("button", { name: /Cambiar disponibilidad/ })); await page.waitForTimeout(500); } },
  { name: "buscar", path: "/buscar", role: "worker", interact: async (page) => { await tap(page.getByRole("switch", { name: /Urgentes/ })); await page.waitForTimeout(300); await tap(page.getByRole("button", { name: /Mejores pagos/ })); await page.waitForTimeout(300); } },
  { name: "mis-turnos", path: "/my-shifts", role: "worker" },
  { name: "mapa", path: "/map", role: "worker" },
  { name: "perfil", path: "/profile", role: "worker" },
  { name: "panel", path: "/shifts", role: "employer", interact: async (page) => { for (const t of [/^Buscando/, /^En marcha/, /^Terminados/, /^Todos/]) { await tap(page.getByRole("button", { name: t }).first()); await page.waitForTimeout(250); } } },
  { name: "publicar", path: "/shifts/new", role: "employer", interact: async (page) => { await page.locator("input[type=text], textarea").first().pressSequentially("Mozo para evento", { delay: 40 }); await page.waitForTimeout(300); } },
];

// ------------------------------------------------------------ script en página

// Corre antes que cualquier script de la página. Instala los observadores de
// métricas y un gancho de React DevTools que cuenta los componentes que se
// renderizaron en cada commit (mismo criterio que el Profiler de DevTools: un
// subárbol que React no clonó no se renderizó; uno clonado se renderizó si
// tiene la marca PerformedWork).
function initScript() {
  try {
    performance.setResourceTimingBufferSize(2000);
  } catch {}
  const m = (window.__perf = { lcp: 0, cls: 0, longtasks: [], phase: "load", renders: { load: 0, idle: 0, inter: 0 }, commits: { load: 0, idle: 0, inter: 0 }, byName: { load: {}, idle: {}, inter: {} } });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.longtasks.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: true });
  } catch {}

  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // Function, Class, ForwardRef, Memo, SimpleMemo
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return "?";
    if (typeof t === "function") return t.displayName || t.name || "anónimo";
    if (t.render) return t.displayName || t.render.displayName || t.render.name || "forwardRef";
    if (t.type) return t.displayName || nameOf({ type: t.type });
    return "?";
  };
  const count = (fiber) => {
    const phase = m.phase;
    const stack = [fiber];
    while (stack.length) {
      const f = stack.pop();
      const alt = f.alternate;
      if (COMPONENT_TAGS.has(f.tag) && (alt === null || (f.flags & 1) !== 0)) {
        m.renders[phase]++;
        const n = nameOf(f);
        m.byName[phase][n] = (m.byName[phase][n] || 0) + 1;
      }
      // Subárbol sin clonar: no se renderizó en este commit.
      if (alt !== null && f.child === alt.child) continue;
      for (let c = f.child; c; c = c.sibling) stack.push(c);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(r) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, r);
      return id;
    },
    onCommitFiberRoot(_id, root) {
      m.commits[m.phase]++;
      try {
        count(root.current);
      } catch {}
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
}

// ------------------------------------------------------------------- medición

async function runScenario(browser, sc) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.addInitScript(initScript);
  await page.addInitScript(
    ({ role }) => {
      sessionStorage.setItem("staffya_splash_seen", "1");
      if (role) {
        localStorage.setItem("staffya_token", "perf-fake-access-token");
        localStorage.setItem("staffya_has_session", "1");
        for (const k of ["staffya_tour_worker_feed", "staffya_tour_employer_panel"]) localStorage.setItem(k, "1");
      }
    },
    { role: sc.role },
  );

  if (process.env.MEDIR_DEBUG) page.on("pageerror", (e) => console.error("pageerror:", e.message.split("\n")[0]));
  const api = [];
  // Nada sale del contenedor: la API se simula y cualquier otro host externo
  // se corta (el build apunta a la API de producción si no se define
  // NEXT_PUBLIC_API_URL, así que esto es lo que la protege).
  await page.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.includes("/api/v1/"),
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const i = url.pathname.indexOf("/api/v1/");
      if (i >= 0) {
        const path = url.pathname.slice(i + 7);
        api.push(`${req.method()} ${path}${url.search}`);
        await new Promise((r) => setTimeout(r, 100)); // latencia de la API
        const body = req.method() === "GET" ? apiResponse(sc.role, path) : path === "/workers/me/profile" ? WORKER_PROFILE : {};
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      }
      if (/\/style\.json(\?.*)?$/.test(url.pathname + url.search)) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [] }) });
      }
      return route.abort();
    },
  );
  await page.routeWebSocket(/.*/, () => {}); // el socket de avisos queda abierto y callado, como en uso real

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (THROTTLE) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1638.4 * 1024) / 8,
      uploadThroughput: (675 * 1024) / 8,
    });
  }

  const t0 = Date.now();
  await page.goto(BASE + sc.path, { waitUntil: "load", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const loadMs = Date.now() - t0;
  const apiLoad = api.length;
  await page.evaluate(() => {
    window.__perf.phase = "idle";
    window.__perf.loadEnd = performance.now();
  });
  await page.waitForTimeout(IDLE_MS);
  // Interacción opcional del escenario: renders de esa fase aparte (`inter`).
  let interError = null;
  if (sc.interact) {
    await page.evaluate(() => { window.__perf.phase = "inter"; });
    page.setDefaultTimeout(4000);
    await sc.interact(page).catch(async (e) => { interError = e.message.split("\n")[0]; await page.screenshot({ path: `/tmp/claude-0/perf-render/err-${sc.name}.png` }).catch(() => {}); });
    await page.evaluate(() => { window.__perf.phase = "idle"; });
  }

  const perf = await page.evaluate(() => {
    const m = window.__perf;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const tbt = m.longtasks.filter(([s]) => s >= fcp).reduce((acc, [, d]) => acc + Math.max(0, d - 50), 0);
    const res = performance.getEntriesByType("resource").filter((r) => new URL(r.name).hostname === location.hostname && !r.name.includes("/api/v1/"));
    const kind = (r) =>
      /\.js(\?|$)/.test(r.name) ? "js" : /\.css(\?|$)/.test(r.name) ? "css" : /\.(woff2?|ttf|otf)(\?|$)/.test(r.name) ? "font" : /\.(png|jpe?g|webp|avif|gif|svg|ico)(\?|$)|\/_next\/image/.test(r.name) ? "img" : "other";
    // `bytes`: lo que se bajó hasta el fin de la carga (lo que la pantalla
    // necesita). `bytesTotal`: incluye lo que Next precarga después, en los
    // 10 s quietos, para las pantallas a las que llevan los links.
    const sum = (list) => {
      const out = {};
      for (const r of list) {
        const k = kind(r);
        out[k] ??= { n: 0, transfer: 0, decoded: 0 };
        out[k].n++;
        out[k].transfer += r.encodedBodySize;
        out[k].decoded += r.decodedBodySize;
      }
      return out;
    };
    const bytes = sum(res.filter((r) => r.startTime <= m.loadEnd));
    const bytesTotal = sum(res);
    const nav = performance.getEntriesByType("navigation")[0];
    bytes.html = { n: 1, transfer: nav?.encodedBodySize ?? 0, decoded: nav?.decodedBodySize ?? 0 };
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12);
    return {
      fcp, lcp: m.lcp, tbt, cls: m.cls, bytes, bytesTotal,
      commits: m.commits, renders: m.renders,
      topLoad: top(m.byName.load), topIdle: top(m.byName.idle), topInter: top(m.byName.inter),
    };
  });
  const { metrics } = await cdp.send("Performance.getMetrics");
  const metric = (n) => metrics.find((x) => x.name === n)?.value ?? 0;
  await context.close();

  const counts = {};
  for (const k of api) counts[k] = (counts[k] || 0) + 1;
  const dup = Object.entries(counts).filter(([, n]) => n > 1);
  return {
    ...perf,
    interError,
    loadMs,
    scriptMs: Math.round(metric("ScriptDuration") * 1000),
    taskMs: Math.round(metric("TaskDuration") * 1000),
    heapMB: +(metric("JSHeapUsedSize") / 1048576).toFixed(1),
    api: { load: apiLoad, total: api.length, distinct: Object.keys(counts).length, duplicated: dup, list: counts },
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function main() {
  // Igual que playwright.config.ts: en la sesión cloud, el Chromium preinstalado.
  const LOCAL = process.env.PW_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(existsSync(LOCAL) ? { executablePath: LOCAL } : {});
  const out = { base: BASE, runs: RUNS, throttle: THROTTLE, date: new Date().toISOString(), scenarios: {} };
  for (const sc of SCENARIOS.filter((s) => !ONLY || ONLY.includes(s.name))) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      // Un reintento si el navegador cierra la página a mitad de camino.
      runs.push(await runScenario(browser, sc).catch((e) => (console.error(`${sc.name}: reintento (${e.message.split("\n")[0]})`), runScenario(browser, sc))));
    }
    const last = runs[runs.length - 1];
    const med = (f) => median(runs.map(f));
    out.scenarios[sc.name] = {
      path: sc.path,
      fcp: Math.round(med((r) => r.fcp)),
      lcp: Math.round(med((r) => r.lcp)),
      tbt: Math.round(med((r) => r.tbt)),
      cls: +med((r) => r.cls).toFixed(3),
      scriptMs: med((r) => r.scriptMs),
      taskMs: med((r) => r.taskMs),
      heapMB: med((r) => r.heapMB),
      bytes: last.bytes,
      bytesTotal: last.bytesTotal,
      commits: last.commits,
      renders: last.renders,
      api: last.api,
      topLoad: last.topLoad,
      topIdle: last.topIdle,
      topInter: last.topInter,
      interError: last.interError,
    };
    printScenario(sc.name, out.scenarios[sc.name]);
  }
  await browser.close();
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
}

function kb(b) {
  return (b / 1024).toFixed(0);
}
function printScenario(name, s) {
  const js = s.bytes.js ?? { transfer: 0, decoded: 0, n: 0 };
  console.log(
    `${name.padEnd(11)} JS ${kb(js.transfer)} KB (${kb(js.decoded)} KB sin comprimir, ${js.n} archivos) · ` +
      `FCP ${s.fcp} · LCP ${s.lcp} · TBT ${s.tbt} · script ${s.scriptMs} ms · ` +
      `renders ${s.renders.load}+${s.renders.idle} quietos` + (s.renders.inter ? ` +${s.renders.inter} interacción (${s.commits.inter} commits)` : "") + (s.interError ? ` [interacción falló: ${s.interError}]` : "") + ` · API ${s.api.load} (${s.api.duplicated.length} repetidos)`,
  );
}

function compare(a, b) {
  const rows = [["escenario", "JS transf. (KB)", "JS sin compr. (KB)", "JS con precarga (KB)", "fuentes (KB)", "FCP (ms)", "LCP (ms)", "TBT (ms)", "script (ms)", "renders carga", "renders quietos", "renders interacción", "pedidos API", "repetidos"]];
  const pair = (x, y) => (x === y ? `${x}` : `${x} → ${y}`);
  for (const name of Object.keys(b.scenarios)) {
    const x = a.scenarios[name];
    const y = b.scenarios[name];
    if (!x) continue;
    const g = (s, k, f = "transfer") => +kb(s.bytes[k]?.[f] ?? 0);
    rows.push([
      name,
      pair(g(x, "js"), g(y, "js")),
      pair(g(x, "js", "decoded"), g(y, "js", "decoded")),
      pair(+kb(x.bytesTotal?.js?.transfer ?? 0), +kb(y.bytesTotal?.js?.transfer ?? 0)),
      pair(g(x, "font"), g(y, "font")),
      pair(x.fcp, y.fcp),
      pair(x.lcp, y.lcp),
      pair(x.tbt, y.tbt),
      pair(x.scriptMs, y.scriptMs),
      pair(x.renders.load, y.renders.load),
      pair(x.renders.idle, y.renders.idle),
      pair(x.renders.inter ?? 0, y.renders.inter ?? 0),
      pair(x.api.load, y.api.load),
      pair(x.api.duplicated.length, y.api.duplicated.length),
    ]);
  }
  console.log(rows.map((r) => `| ${r.join(" | ")} |`).join("\n").replace(/^(\|.*\|)\n/, `$1\n|${" --- |".repeat(rows[0].length)}\n`));
}


await main();
