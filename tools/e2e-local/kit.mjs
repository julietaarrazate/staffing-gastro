// kit.mjs — helper de Playwright para la etapa 1 (prueba de punta a punta) de Oído.
//
// Producto REAL: frontend http://localhost:3100 y backend http://localhost:8000
// (nunca se interceptan). Terceros: todo va al servidor de simulados
// (http://127.0.0.1:8901). Instrucciones de uso: KIT.md, al lado de este archivo.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `import "playwright"` no resuelve desde el scratchpad en ESM (NODE_PATH sólo
// vale para `require`): se carga por createRequire y se reexporta.
const require = createRequire(import.meta.url);
export const playwright = (() => {
  try {
    return require("playwright");
  } catch {
    // Sin NODE_PATH: se usa el playwright del frontend del repo.
    const front = path.join(process.env.E1_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), "frontend", "package.json");
    return createRequire(front)("playwright");
  }
})();
const { chromium, devices } = playwright;

export const HARNESS = path.dirname(fileURLToPath(import.meta.url));
// Código en el repo (HARNESS); estado y datos fuera de él, en E1_DIR.
export const E1 = path.resolve(process.env.E1_DIR || "/tmp/oido-e2e");
export const STATE = path.join(E1, "state");
export const E1_DB = process.env.E1_DB || "oido_e1";
fs.mkdirSync(path.join(E1, "logs", "sessions"), { recursive: true });
fs.mkdirSync(STATE, { recursive: true });
export const FRONT = "http://localhost:3100";
export const BACKEND = "http://localhost:8000";
export const API = `${BACKEND}/api/v1`;
export const FAKES = "http://127.0.0.1:8901";
// Mismo servidor de simulados por https (certificado autofirmado): sólo para
// las subidas de archivos, ver el manejador de rutas de newSession().
export const FAKES_TLS = "https://127.0.0.1:8902";
export const EVIDENCE = path.join(E1, "evidence");
export const LOGS = path.join(E1, "logs");
export const DEMO_PASSWORD = "staffyaDemo123";
export const DEFAULT_PASSWORD = "E1-prueba-1234"; // contraseña de prueba pública y documentada, no es un secreto  gitleaks:allow

// Node habla con el backend por 127.0.0.1 (sin depender de cómo resuelva
// "localhost"); el navegador usa localhost, que es el origen permitido por CORS.
const API_NODE = "http://127.0.0.1:8000/api/v1";

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const TOUR_KEYS = ["staffya_tour_worker_feed", "staffya_tour_employer_panel"];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mail único para una cuenta de prueba: `<prefijo>-<aleatorio>@e1.test`. */
export function uniq(prefix = "e1") {
  const clean = String(prefix).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "e1";
  return `${clean}-${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}@e1.test`;
}

function agentName(explicit) {
  return (explicit || process.env.E1_AGENT || "sin-agente").replace(/[^\w.-]+/g, "_");
}

// ─────────────────────────────── navegador ─────────────────────────────────

/** Chromium preinstalado. Además deja listos los archivos de prueba (`assets`). */
export async function launch(options = {}) {
  const browser = await chromium.launch({ headless: true, ...options });
  await ensureAssets(browser);
  return browser;
}

function isProduct(url) {
  return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.port === "3100" || url.port === "8000");
}

/** A qué URL del simulado va un pedido externo; `null` = no hay simulado. */
function fakeTarget(url) {
  const host = url.hostname;
  const tail = url.pathname + url.search;
  if (host === "nominatim.openstreetmap.org") return `${FAKES}/nominatim${tail}`;
  if (host === "basemaps.cartocdn.com") return `${FAKES}/carto${tail}`;
  if (host.endsWith(".basemaps.cartocdn.com")) return `${FAKES}/carto-tiles${tail}`;
  if (host === "api.cloudinary.com") return `${FAKES}/cloudinary${tail}`;
  if (host === "res.cloudinary.com") return `${FAKES}/res${tail}`;
  if (host === "accounts.google.com" && url.pathname.startsWith("/gsi/client")) return `${FAKES}/gsi/client.js`;
  // Fotos demo del seed y avatares externos → placeholder.
  if (host === "loremflickr.com" || host.endsWith(".loremflickr.com") || host === "picsum.photos" || host === "images.unsplash.com") {
    return `${FAKES}/placeholder/photo?seed=${encodeURIComponent(url.searchParams.get("lock") || url.pathname)}`;
  }
  if (host.endsWith("pravatar.cc") || host === "ui-avatars.com" || host === "randomuser.me" || host.endsWith(".googleusercontent.com")) {
    return `${FAKES}/placeholder/avatar?seed=${encodeURIComponent(url.searchParams.get("img") || url.pathname)}`;
  }
  return null;
}

/**
 * Una sesión = un contexto aislado (su propio localStorage y cookies).
 *
 *   const s = await newSession(browser, { name: "comercio", viewport: "mobile", theme: "light" });
 *   await s.page.goto("/login");          // baseURL = http://localhost:3100
 *   await s.shot("login");
 *   await s.close();
 *
 * Opciones: name · viewport "mobile" (390×844 @2x, táctil) | "desktop" (1280×800)
 * · theme "light" | "dark" · geo {lat, lng} (sin geo, el permiso de ubicación
 * queda DENEGADO) · skipTours (true) · skipSplash (true) · googleUser
 * {email, name} para el botón de Google simulado · agent (carpeta de evidencia).
 */
export async function newSession(browser, opts = {}) {
  const {
    name = `sesion-${crypto.randomBytes(3).toString("hex")}`,
    viewport = "mobile",
    theme = "light",
    geo = null,
    skipTours = true,
    skipSplash = true,
    googleUser = null,
    agent,
    contextOptions = {},
  } = opts;
  if (!VIEWPORTS[viewport]) throw new Error(`viewport desconocido: ${viewport} (mobile | desktop)`);
  if (theme !== "light" && theme !== "dark") throw new Error(`theme desconocido: ${theme} (light | dark)`);
  const vp = VIEWPORTS[viewport];

  const context = await browser.newContext({
    baseURL: FRONT,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    ...(viewport === "mobile" ? { userAgent: devices["Pixel 7"].userAgent } : {}),
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    // Sólo por el certificado autofirmado del simulado (subidas de archivos).
    ignoreHTTPSErrors: true,
    ...(geo ? { geolocation: { latitude: geo.lat, longitude: geo.lng, accuracy: 20 }, permissions: ["geolocation"] } : {}),
    ...contextOptions,
  });

  const log = makeLog(name);
  log.push("session-start", { viewport, theme, geo, agent: agentName(agent) });

  // Antes del primer render: tema (clave real de lib/theme.tsx), splash y
  // tours. Se siembra UNA vez por contexto: si después cambiás el tema desde
  // la app, una recarga no te lo pisa.
  await context.addInitScript(
    ({ theme, skipTours, skipSplash, tourKeys, googleUser }) => {
      try {
        if (!window.localStorage.getItem("e1_seeded")) {
          window.localStorage.setItem("e1_seeded", "1");
          window.localStorage.setItem("oido-theme", theme);
          if (skipTours) for (const key of tourKeys) window.localStorage.setItem(key, "1");
        }
        if (skipSplash) window.sessionStorage.setItem("staffya_splash_seen", "1");
      } catch {}
      if (googleUser) window.__E1_GOOGLE_USER = googleUser;
    },
    { theme, skipTours, skipSplash, tourKeys: TOUR_KEYS, googleUser }
  );

  // Hosts externos → simulados. El producto (localhost:3100 y :8000) no pasa
  // por este manejador.
  const unrouted = new Set();
  await context.route(
    (url) => !isProduct(url),
    async (route) => {
      const request = route.request();
      let url;
      try {
        url = new URL(request.url());
      } catch {
        return route.continue();
      }
      if (!/^https?:$/.test(url.protocol)) return route.continue();
      if (url.hostname === "127.0.0.1" && (url.port === "8901" || url.port === "8902")) return route.continue();
      const target = fakeTarget(url);
      if (!target) {
        unrouted.add(request.url());
        log.push("external-unrouted", { method: request.method(), url: request.url(), resource: request.resourceType(), page: safePageUrl(request) });
        return route.abort("failed").catch(() => {});
      }
      try {
        if (request.method() !== "GET" && request.method() !== "HEAD" && url.protocol === "https:") {
          // Pedido con cuerpo (subida a Cloudinary): lo manda el propio
          // navegador al simulado por https. Reenviarlo desde Node perdería
          // el archivo: Chromium no entrega el contenido de un archivo
          // elegido del disco. Para la página sigue siendo la URL original.
          return await route.continue({ url: target.replace(FAKES, FAKES_TLS) });
        }
        const response = await route.fetch({ url: target, timeout: 20000 });
        await route.fulfill({ response });
      } catch (error) {
        log.push("fake-error", { url: request.url(), target, error: String(error?.message || error).split("\n")[0] });
        await route.abort("failed").catch(() => {});
      }
    }
  );

  context.on("console", (message) => {
    const type = message.type();
    if (type !== "error" && type !== "warning") return;
    const text = message.text();
    // Ruido del WebGL por software de este contenedor al sacar capturas del mapa.
    if (/GL Driver Message|GPU stall due to ReadPixels/.test(text)) return;
    const kind = /Content Security Policy|Content-Security-Policy/i.test(text) ? "csp" : `console-${type}`;
    log.push(kind, { text: text.slice(0, 1500), page: safeUrl(message.page()), location: message.location()?.url });
  });
  context.on("weberror", (webError) => {
    const error = webError.error();
    log.push("pageerror", { text: String(error?.message || error).slice(0, 1500), stack: String(error?.stack || "").slice(0, 1500), page: safeUrl(webError.page()) });
  });
  context.on("requestfailed", (request) => {
    if (unrouted.has(request.url())) return; // ya anotado como external-unrouted
    const error = request.failure()?.errorText;
    // ERR_ABORTED = pedido cancelado por la propia app (prefetch de Next al
    // navegar, búsqueda reemplazada por otra, pestaña cerrada): va aparte y
    // no cuenta como problema.
    const type = error === "net::ERR_ABORTED" ? "request-aborted" : "requestfailed";
    log.push(type, { method: request.method(), url: request.url(), error, resource: request.resourceType(), page: safePageUrl(request) });
  });
  context.on("response", async (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    const fromBackend = url.startsWith(BACKEND);
    if (!fromBackend && !url.startsWith(FRONT)) return;
    let body = "";
    if (fromBackend) {
      try {
        body = (await response.text()).slice(0, 600);
      } catch {}
    }
    log.push(fromBackend ? "http-error" : "http-error-front", { method: response.request().method(), url, status, body, page: safePageUrl(response.request()) });
  });

  const page = await context.newPage();
  const session = {
    name,
    viewport,
    theme,
    agent: agentName(agent),
    context,
    page,
    log,
    /** Captura → evidence/<AGENT>/<nombre>_<390|1280>_<light|dark>.png. Devuelve la ruta. */
    async shot(shotName, shotOpts = {}) {
      const { fullPage = false, page: target = page, ...rest } = shotOpts;
      const width = target.viewportSize()?.width ?? vp.width;
      let current = theme;
      try {
        current = (await target.evaluate(() => document.documentElement.getAttribute("data-theme"))) || theme;
      } catch {}
      const dir = path.join(EVIDENCE, session.agent);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${String(shotName).replace(/[^\w.-]+/g, "-")}_${width}_${current}.png`);
      await target.screenshot({ path: file, fullPage, animations: "disabled", caret: "hide", ...rest });
      log.push("shot", { file, url: safeUrl(target) });
      return file;
    },
    /** Cambia la ubicación simulada del navegador (y da el permiso). */
    async setGeo({ lat, lng }) {
      await context.grantPermissions(["geolocation"], { origin: FRONT });
      await context.setGeolocation({ latitude: lat, longitude: lng, accuracy: 20 });
    },
    /** Quién "es" el botón de Google simulado en esta sesión. */
    async setGoogleUser(user) {
      await context.addInitScript((u) => {
        window.__E1_GOOGLE_USER = u;
      }, user);
      for (const p of context.pages()) await p.evaluate((u) => (window.__E1_GOOGLE_USER = u), user).catch(() => {});
    },
    async close() {
      log.push("session-end", log.summary());
      await context.close().catch(() => {});
      return log.summary();
    },
  };
  return session;
}

function safeUrl(page) {
  try {
    return page?.url();
  } catch {
    return undefined;
  }
}
function safePageUrl(request) {
  try {
    return request.frame()?.page()?.url();
  } catch {
    return undefined;
  }
}

function makeLog(name) {
  const dir = path.join(LOGS, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(name).replace(/[^\w.-]+/g, "_")}.jsonl`);
  const started = Date.now();
  const entries = [];
  return {
    file,
    entries,
    push(type, data = {}) {
      const entry = { ts: new Date().toISOString(), t: Date.now() - started, session: name, type, ...data };
      entries.push(entry);
      try {
        fs.appendFileSync(file, JSON.stringify(entry) + "\n");
      } catch {}
      return entry;
    },
    /** Entradas de uno o más tipos: log.of("http-error", "pageerror"). */
    of(...types) {
      return entries.filter((entry) => types.includes(entry.type));
    },
    /** Todo lo que huele a problema (sin los avisos de consola). */
    problems() {
      return entries.filter((e) => ["pageerror", "console-error", "csp", "http-error", "http-error-front", "requestfailed", "external-unrouted", "fake-error"].includes(e.type));
    },
    summary() {
      const counts = {};
      for (const entry of entries) counts[entry.type] = (counts[entry.type] || 0) + 1;
      return counts;
    },
  };
}

/**
 * Espera la respuesta de una subida a Cloudinary (simulado) y devuelve
 * {status, body}. Llamalo ANTES de disparar la subida:
 *
 *   const subida = waitForUpload(page);
 *   await input.setInputFiles(assets.dniFrente);
 *   const { status, body } = await subida;      // body.secure_url, body.type…
 *
 * Ojo: Playwright muestra esa respuesta con la URL del simulado
 * (https://127.0.0.1:8902/cloudinary/…), no con api.cloudinary.com; para la
 * página es la URL original.
 */
export async function waitForUpload(page, { timeoutMs = 30000 } = {}) {
  const response = await page.waitForResponse((r) => /\/v1_1\/[^/]+\/(auto|image|raw|video)\/upload/.test(r.url()) && r.request().method() === "POST", { timeout: timeoutMs });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  return { status: response.status(), body };
}

// ─────────────────────────── mails (simulados) ─────────────────────────────

/** Mails que recibió una casilla, en orden. Cada uno: {ts, to, subject, html, text, links[]}. */
export async function mailbox(email, { sinceMs = 0 } = {}) {
  const res = await fetch(`${FAKES}/mailbox?to=${encodeURIComponent(email)}&since_ms=${sinceMs}`);
  if (!res.ok) throw new Error(`mailbox: el simulado respondió ${res.status}`);
  return res.json();
}

/** Espera un mail (el más nuevo que coincida). `subject`: RegExp opcional. */
export async function waitForMail(email, { subject, timeoutMs = 15000, sinceMs = 0 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mails = (await mailbox(email, { sinceMs })).filter((m) => !subject || subject.test(m.subject || ""));
    if (mails.length) return mails[mails.length - 1];
    if (Date.now() > deadline) throw new Error(`waitForMail: no llegó ningún mail a ${email}${subject ? ` con asunto ${subject}` : ""} en ${timeoutMs} ms`);
    await sleep(250);
  }
}

/** Primer link del mail que coincide con el patrón (o el primero, sin patrón). */
export function linkFrom(mail, pattern) {
  return (mail?.links || []).find((link) => !pattern || pattern.test(link)) || null;
}

// ──────────────────────────────── API real ─────────────────────────────────

/**
 * Llama al backend REAL. Devuelve {status, ok, data, headers}; no tira por
 * un 4xx/5xx (mirá `ok`). `body` se manda como JSON.
 */
export async function api(method, apiPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${API_NODE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`, {
    method: method.toUpperCase(),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

function must(result, what) {
  if (!result.ok) throw new Error(`${what}: el backend respondió ${result.status} ${JSON.stringify(result.data).slice(0, 400)}`);
  return result.data;
}

const DEFAULT_WORKER_PROFILE = {
  photo_url: null,
  city: "Palermo",
  latitude: -34.5775,
  longitude: -58.4256,
  skills: ["mozo", "bartender"],
  years_experience: 2,
  bio: "Perfil de prueba de la etapa 1.",
  languages: [],
  certifications: [],
  is_available: true,
};
const DEFAULT_COMPANY_PROFILE = {
  name: "Bar de Prueba E1",
  category: "bar",
  description: "Comercio de prueba de la etapa 1.",
  address: "Gorriti 5000",
  city: "Palermo",
  latitude: -34.58755,
  longitude: -58.43095,
};

/**
 * Crea una cuenta lista para usar, por el mismo camino que una persona:
 * registro con los términos aceptados → link de verificación del mail →
 * login → perfil mínimo (el que deja el onboarding de /bienvenida).
 *
 *   const w = await registerViaApi({ role: "worker", email: uniq("ag3-mozo") });
 *   // → { email, password, token, userId, user, profile }
 *
 * Opciones: password · fullName · verify:false (deja el mail sin confirmar)
 * · profile:false (sin perfil, como recién registrado) o un objeto que pisa
 * campos del perfil por defecto.
 */
export async function registerViaApi({ role = "worker", email, password = DEFAULT_PASSWORD, fullName, verify = true, profile = {} } = {}) {
  if (role !== "worker" && role !== "employer") throw new Error("registerViaApi: role debe ser 'worker' o 'employer'");
  email = email || uniq(role);
  fullName = fullName || (role === "worker" ? "Trabajadora de Prueba" : "Comercio de Prueba");
  const sinceMs = Date.now() - 2000;
  const user = must(await api("POST", "/auth/register", { body: { email, password, full_name: fullName, role, accepted_terms: true } }), "registro");

  if (verify) {
    const mail = await waitForMail(email, { subject: /Confirm[aá] tu email/i, sinceMs });
    const link = linkFrom(mail, /\/verificar-email\?token=/);
    if (!link) throw new Error("registerViaApi: el mail de verificación no trae el link");
    const tokenParam = new URL(link).searchParams.get("token");
    const verified = await api("POST", "/auth/verify-email", { body: { token: tokenParam } });
    if (verified.status !== 204) throw new Error(`verificar email: ${verified.status} ${JSON.stringify(verified.data)}`);
  }

  const session = must(await api("POST", "/auth/login", { body: { email, password } }), "login");
  const token = session.access_token;
  let savedProfile = null;
  if (profile !== false) {
    const payload = role === "worker" ? { ...DEFAULT_WORKER_PROFILE, ...profile } : { ...DEFAULT_COMPANY_PROFILE, ...profile };
    const base = role === "worker" ? "/workers/me/profile" : "/companies/me/profile";
    savedProfile = must(await api("POST", base, { token, body: payload }), "perfil");
  }
  return { email, password, token, userId: user.id, user: session.user ?? user, profile: savedProfile, role };
}

/** Access token nuevo por API (los tokens vencen a los 15 minutos). */
export async function apiLogin({ email, password }) {
  const data = must(await api("POST", "/auth/login", { body: { email, password } }), "login");
  if (data.two_factor_required) throw new Error("apiLogin: la cuenta pide verificación en dos pasos (usá adminSession)");
  return data.access_token;
}

/** Login por la UI real (/login). Deja la página donde la app la mande. */
export async function loginAs(page, { email, password }) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.url();
}

// ───────────────────────────── admin + 2 pasos ─────────────────────────────

/** Cuentas admin de prueba (admin.json): admin1..8 con 2FA, admin9 sin alta. */
export function admins() {
  const file = path.join(STATE, "admin.json");
  if (!fs.existsSync(file)) throw new Error(`Falta ${file}: corré ${path.join(HARNESS, "bootstrap_admins.py")}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function admin(n = 1) {
  const entry = admins().find((a) => a.n === Number(n));
  if (!entry) throw new Error(`No hay admin${n} (hay del 1 al 9)`);
  return entry;
}

function totpAt(secret, step) {
  const cleaned = secret.replace(/\s+/g, "").toUpperCase();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of cleaned) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

const currentStep = () => Math.floor(Date.now() / 1000 / 30);

/** Código TOTP del paso actual del admin `n`. Ojo: el backend no acepta dos
 * veces el mismo paso; para logins seguidos usá `totpFresh(n)`. */
export function totpNow(n = 1) {
  const entry = admin(n);
  if (!entry.totp_secret) throw new Error(`admin${n} no tiene la verificación activada (enrolled: false)`);
  return totpAt(entry.totp_secret, currentStep());
}

/**
 * Código TOTP todavía NO usado del admin `n` (reserva el paso en un archivo
 * compartido entre procesos; si hace falta, espera hasta el próximo paso).
 */
export async function totpFresh(n = 1) {
  const entry = admin(n);
  if (!entry.totp_secret) throw new Error(`admin${n} no tiene la verificación activada (enrolled: false)`);
  const dir = path.join(STATE, ".totp");
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, `admin${n}.lock`);
  const stateFile = path.join(dir, `admin${n}.json`);
  const lockDeadline = Date.now() + 90000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 75000) fs.rmdirSync(lock);
      } catch {}
      if (Date.now() > lockDeadline) throw new Error(`totpFresh: no pude tomar el turno de admin${n}`);
      await sleep(200);
    }
  }
  try {
    let last = -1;
    try {
      last = JSON.parse(fs.readFileSync(stateFile, "utf8")).lastStep ?? -1;
    } catch {}
    const step = Math.max(currentStep(), last + 1);
    // El backend acepta el paso actual ±1: si el reservado está más adelante, se espera.
    while (step > currentStep() + 1) await sleep(500);
    fs.writeFileSync(stateFile, JSON.stringify({ lastStep: step }));
    return totpAt(entry.totp_secret, step);
  } finally {
    try {
      fs.rmdirSync(lock);
    } catch {}
  }
}

/**
 * Sesión ya logueada como admin (login real por UI + código de la app,
 * ADR-0023). `n` de 1 a 8: usá UN número por agente.
 *
 *   const a = await adminSession(browser, { n: 3, viewport: "desktop", theme: "dark" });
 *   await a.page.goto("/admin");
 */
export async function adminSession(browser, opts = {}) {
  const { n = 1, ...sessionOpts } = opts;
  const entry = admin(n);
  if (!entry.enrolled) throw new Error(`admin${n} no tiene 2FA (es la cuenta para probar el alta): usá newSession + loginAs`);
  const session = await newSession(browser, { name: `admin${n}`, ...sessionOpts });
  const { page } = session;
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(entry.email);
  await page.locator('input[name="password"]').fill(entry.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  const codeInput = page.locator('input[name="one-time-code"]');
  await codeInput.waitFor({ timeout: 20000 });
  for (let attempt = 1; ; attempt++) {
    await codeInput.fill(await totpFresh(n));
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 12000 });
      break;
    } catch (error) {
      if (attempt >= 3) throw new Error(`adminSession: no pasó la verificación en dos pasos de admin${n} (${error.message.split("\n")[0]})`);
    }
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  session.admin = entry;
  return session;
}

/**
 * Access token de un admin por API (login + código de la app), para llamar
 * endpoints de admin sin navegador: `api("GET", "/admin/…", { token })`.
 * Vence a los 15 minutos; pedí otro cuando haga falta.
 */
export async function adminApiToken(n = 1) {
  const entry = admin(n);
  const login = must(await api("POST", "/auth/login", { body: { email: entry.email, password: entry.password } }), "login admin");
  if (!login.two_factor_required) return login.access_token; // admin9: sesión que sólo sirve para el alta
  for (let attempt = 1; ; attempt++) {
    const res = await api("POST", "/auth/2fa/verify", { body: { challenge_token: login.challenge_token, code: await totpFresh(n) } });
    if (res.ok) return res.data.access_token;
    if (attempt >= 3) throw new Error(`adminApiToken: ${res.status} ${JSON.stringify(res.data)}`);
  }
}

// ─────────────────────────────── base de datos ─────────────────────────────

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Corre SQL en la base local `oido_e1` y devuelve las filas como objetos
 * (todo llega como texto; "" = NULL). Sirve para "adelantar el reloj" de un
 * turno PROPIO. Regla: sólo sobre filas creadas por tu propio agente, y
 * decilo en el hallazgo. Cada llamada queda anotada en logs/db.jsonl.
 */
export function db(sql) {
  fs.appendFileSync(path.join(LOGS, "db.jsonl"), JSON.stringify({ ts: new Date().toISOString(), agent: agentName(), sql }) + "\n");
  // La conexión sale del mismo DATABASE_URL que usa el backend de prueba
  // (ver _env.sh), para no repetir las credenciales de la base local acá.
  const url = new URL((process.env.DATABASE_URL || `postgresql://oido:oido@localhost:5432/${E1_DB}`).replace("+asyncpg", ""));
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`db(): DATABASE_URL apunta a '${url.hostname}', no a una base local. No se usa.`);
  }
  const out = execFileSync("psql", ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", url.pathname.slice(1), "-X", "-q", "--csv", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const rows = parseCsv(out);
  if (rows.length < 1) return [];
  const [header, ...data] = rows;
  return data.map((cells) => Object.fromEntries(header.map((column, i) => [column, cells[i] ?? ""])));
}

// ─────────────────────────── toques, teclas y tiempo ───────────────────────

const counters = new WeakMap();

/**
 * Cuenta toques/clicks y teclas reales sobre la página, con marcas de tiempo.
 *
 *   const c = await counter(page);
 *   c.mark("empieza a publicar");
 *   …                                  // page.click / tap / keyboard.type
 *   c.mark("turno publicado");
 *   console.log(c.report());           // { taps, keys, chars, seconds, marks, events }
 *
 * `taps`: clicks o toques (un `click` confiable). `keys`: teclas apretadas
 * (`page.keyboard.type` / `pressSequentially`). `chars`: caracteres que
 * entraron a campos, también con `fill()` (que no genera teclas).
 */
export async function counter(page) {
  if (counters.has(page)) return counters.get(page);
  const state = { taps: 0, keys: 0, chars: 0, events: [], marks: [], started: Date.now() };
  const api_ = {
    mark(label) {
      const mark = { label, t: Date.now() - state.started, taps: state.taps, keys: state.keys, chars: state.chars, at: new Date().toISOString() };
      state.marks.push(mark);
      return mark;
    },
    reset() {
      Object.assign(state, { taps: 0, keys: 0, chars: 0, events: [], marks: [], started: Date.now() });
    },
    /** Diferencia entre dos marcas: { seconds, taps, keys, chars }. */
    between(fromLabel, toLabel) {
      const a = state.marks.find((m) => m.label === fromLabel);
      const b = state.marks.find((m) => m.label === toLabel);
      if (!a || !b) throw new Error(`counter.between: falta la marca ${!a ? fromLabel : toLabel}`);
      return { seconds: Math.round((b.t - a.t) / 100) / 10, taps: b.taps - a.taps, keys: b.keys - a.keys, chars: b.chars - a.chars };
    },
    report() {
      return {
        taps: state.taps,
        keys: state.keys,
        chars: state.chars,
        seconds: Math.round((Date.now() - state.started) / 100) / 10,
        marks: state.marks,
        events: state.events,
      };
    },
  };
  await page.exposeBinding("__e1Count", (_source, event) => {
    if (event.kind === "tap") state.taps += 1;
    else if (event.kind === "key") state.keys += 1;
    else if (event.kind === "chars") state.chars += event.n;
    state.events.push({ t: Date.now() - state.started, ...event });
  });
  const install = () => {
    if (window.__e1CounterInstalled) return;
    window.__e1CounterInstalled = true;
    const describe = (el) => {
      if (!el || !el.tagName) return "";
      const text = (el.getAttribute?.("aria-label") || el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.name ? `[name=${el.name}]` : ""}${text ? ` "${text}"` : ""}`;
    };
    const lengths = new WeakMap();
    document.addEventListener("click", (e) => e.isTrusted && window.__e1Count({ kind: "tap", target: describe(e.target) }), true);
    document.addEventListener(
      "keydown",
      (e) => e.isTrusted && !["Shift", "Control", "Alt", "Meta"].includes(e.key) && window.__e1Count({ kind: "key", key: e.key.length === 1 ? "char" : e.key }),
      true
    );
    document.addEventListener(
      "input",
      (e) => {
        const el = e.target;
        if (!el || typeof el.value !== "string") return;
        const before = lengths.get(el) ?? 0;
        lengths.set(el, el.value.length);
        if (el.value.length > before) window.__e1Count({ kind: "chars", n: el.value.length - before, target: describe(el).split(" ")[0] });
      },
      true
    );
  };
  await page.addInitScript(install);
  await page.evaluate(install).catch(() => {});
  counters.set(page, api_);
  return api_;
}

// ────────────────────────────── Google simulado ────────────────────────────

/** id_token falso que acepta el tokeninfo simulado (para POST /auth/google por API). */
export function googleCredential({ email, name = "Usuaria Google E1", sub, picture = "", email_verified, aud } = {}) {
  const payload = { email, name, sub: sub || `e1-${email}`, picture, ...(email_verified === false ? { email_verified: false } : {}), ...(aud ? { aud } : {}) };
  return `e1fake.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

// ─────────────────────────────── push (plomería) ───────────────────────────

/**
 * Suscripción push de mentira pero con forma válida (endpoint de FCM y claves
 * reales), para `POST /push/subscribe` por API. El backend manda el push al
 * simulado; `pushOutbox(sub.endpoint)` dice cuántos salieron. NO prueba que
 * el navegador muestre la notificación.
 */
export function fakePushSubscription(label = "e1") {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${String(label).replace(/[^\w-]+/g, "-")}-${crypto.randomBytes(8).toString("hex")}`,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") },
  };
}

export async function pushOutbox(endpoint, { sinceMs = 0 } = {}) {
  const res = await fetch(`${FAKES}/push/outbox?endpoint=${encodeURIComponent(endpoint)}&since_ms=${sinceMs}`);
  return res.json();
}

// ─────────────────────────────── archivos de prueba ────────────────────────

const ASSETS_DIR = path.join(STATE, "assets");
/** Archivos para `setInputFiles`. Se generan solos la primera vez (launch()). */
export const assets = {
  foto: path.join(ASSETS_DIR, "foto-perfil.jpg"),
  logo: path.join(ASSETS_DIR, "logo-comercio.png"),
  portada: path.join(ASSETS_DIR, "portada-local.jpg"),
  dniFrente: path.join(ASSETS_DIR, "dni-frente.jpg"),
  dniDorso: path.join(ASSETS_DIR, "dni-dorso.jpg"),
  selfie: path.join(ASSETS_DIR, "selfie.jpg"),
  constancia: path.join(ASSETS_DIR, "constancia-afip.pdf"),
  cv: path.join(ASSETS_DIR, "cv.pdf"),
  texto: path.join(ASSETS_DIR, "no-es-imagen.txt"),
  /** JPG válido de ~11 MB (supera el tope de 10 MB del simulado de Cloudinary). */
  grande: path.join(ASSETS_DIR, "foto-11mb.jpg"),
};

async function ensureAssets(browser) {
  if (Object.values(assets).every((file) => fs.existsSync(file))) return;
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const draw = async (file, width, height, type, title, subtitle, hue) => {
    const dataUrl = await page.evaluate(
      ({ width, height, type, title, subtitle, hue }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, `hsl(${hue} 55% 78%)`);
        gradient.addColorStop(1, `hsl(${(hue + 40) % 360} 55% 52%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.42, Math.min(width, height) * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(width / 2, height * 0.95, Math.min(width, height) * 0.3, Math.min(width, height) * 0.3, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#1b1b1b";
        ctx.textAlign = "center";
        ctx.font = `bold ${Math.round(width / 14)}px sans-serif`;
        ctx.fillText(title, width / 2, height * 0.14);
        ctx.font = `${Math.round(width / 26)}px sans-serif`;
        ctx.fillText(subtitle, width / 2, height * 0.21);
        return canvas.toDataURL(type, 0.86);
      },
      { width, height, type, title, subtitle, hue }
    );
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  };
  const note = "Archivo de prueba E1 — no es real";
  await draw(assets.foto, 900, 900, "image/jpeg", "FOTO DE PERFIL", note, 205);
  await draw(assets.logo, 512, 512, "image/png", "LOGO", note, 35);
  await draw(assets.portada, 1600, 900, "image/jpeg", "PORTADA DEL LOCAL", note, 150);
  await draw(assets.dniFrente, 1000, 630, "image/jpeg", "DNI — FRENTE", note, 190);
  await draw(assets.dniDorso, 1000, 630, "image/jpeg", "DNI — DORSO", note, 260);
  await draw(assets.selfie, 900, 1200, "image/jpeg", "SELFIE", note, 320);
  const pdf = async (file, title, lines) => {
    await page.setContent(`<html><body style="font-family:sans-serif;padding:48px"><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join("")}<p><em>${note}</em></p></body></html>`);
    await page.pdf({ path: file, format: "A4" });
  };
  await pdf(assets.constancia, "Constancia de inscripción", ["CUIT 30-00000000-0", "Razón social: Bar de Prueba E1 S.R.L.", "Actividad: servicios de expendio de bebidas"]);
  await pdf(assets.cv, "Currículum — Persona de Prueba", ["Moza, 3 años de experiencia en salón.", "Bartender, 1 año.", "Disponibilidad: noches y fines de semana."]);
  fs.writeFileSync(assets.texto, "Esto es un archivo de texto, no una imagen.\n");
  // Un JPG de más de 10 MB: la misma foto con relleno después del fin de imagen.
  fs.writeFileSync(assets.grande, Buffer.concat([fs.readFileSync(assets.foto), Buffer.alloc(11 * 1024 * 1024, 0x20)]));
  await context.close();
}
