// smoke.mjs — prueba de humo del arnés de la etapa 1 de Oído.
//   E1_AGENT=smoke node smoke.mjs
// Recorre, en 390 claro: landing → registro de comercio por la UI → mail de
// verificación → /bienvenida → buscador de direcciones; trabajador creado por
// API → login por UI → /feed → foto de perfil (Cloudinary simulado) → mapa →
// renovación de sesión por cookie; admin con 2 pasos → /admin; alta con el
// botón de Google simulado. Termina con código 1 si algo falla.

import fs from "node:fs";
import path from "node:path";
import {
  launch, newSession, adminSession, registerViaApi, loginAs, waitForMail, linkFrom, mailbox,
  api, db, counter, uniq, assets, totpNow, admins, googleCredential, fakePushSubscription, pushOutbox, apiLogin,
  adminApiToken, waitForUpload, BACKEND, sleep, E1,
} from "./kit.mjs";

process.env.E1_AGENT ||= "smoke";
const results = [];
const shots = {};
let failed = false;

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ ok: true, name, ms: Date.now() - started, detail });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    failed = true;
    results.push({ ok: false, name, ms: Date.now() - started, error: String(error?.message || error) });
    console.log(`  ✗ ${name}\n      ${String(error?.message || error).split("\n").slice(0, 4).join("\n      ")}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await launch();
const sessions = [];
const open = async (opts) => {
  const s = await newSession(browser, { viewport: "mobile", theme: "light", ...opts });
  sessions.push(s);
  return s;
};

// ── 1. Comercio: landing, registro por UI, mail, bienvenida, geocoder ───────
const comercio = await open({ name: "smoke-comercio" });
const comercioEmail = uniq("smoke-comercio");

await step("landing / carga con estilos", async () => {
  await comercio.page.goto("/");
  await comercio.page.waitForLoadState("networkidle");
  const styled = await comercio.page.evaluate(() => ({
    sheets: document.styleSheets.length,
    font: getComputedStyle(document.body).fontFamily,
    theme: document.documentElement.getAttribute("data-theme"),
    text: document.body.innerText.length,
  }));
  assert(styled.sheets > 0 && styled.text > 200, `página sin estilos o vacía: ${JSON.stringify(styled)}`);
  assert(styled.theme === "light", `tema esperado light, hay ${styled.theme}`);
  shots.landing = await comercio.shot("01-landing");
  return `tema ${styled.theme}, ${styled.text} caracteres`;
});

await step("registro de comercio por la UI → /bienvenida", async () => {
  const { page } = comercio;
  const c = await counter(page);
  await page.goto("/register?rol=comercio");
  c.mark("form");
  await page.locator('input[name="name"]').fill("Bar Humo E1");
  await page.locator('input[name="email"]').fill(comercioEmail);
  await page.locator('input[name="new-password"]').fill("E1-prueba-1234");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.waitForURL("**/bienvenida", { timeout: 20000 });
  c.mark("bienvenida");
  const delta = c.between("form", "bienvenida");
  assert(delta.taps >= 2, `el contador no vio los toques: ${JSON.stringify(delta)}`);
  return `${comercioEmail} · contador: ${delta.taps} toques, ${delta.chars} caracteres, ${delta.seconds}s`;
});

await step("mail de verificación: link del mailbox → email confirmado", async () => {
  const mail = await waitForMail(comercioEmail, { subject: /Confirm[aá] tu email/i });
  const link = linkFrom(mail, /\/verificar-email\?token=/);
  assert(link && link.startsWith("http://localhost:3100/"), `link inesperado: ${link}`);
  const tab = await comercio.context.newPage();
  await tab.goto(link);
  await tab.getByText("Listo, tu email quedó confirmado.").waitFor({ timeout: 15000 });
  shots.verificado = await comercio.shot("02-email-verificado", { page: tab });
  await tab.close();
  const row = db(`select is_verified from users where email = '${comercioEmail}'`);
  assert(row[0]?.is_verified === "t", `la base dice is_verified=${row[0]?.is_verified}`);
  const subjects = (await mailbox(comercioEmail)).map((m) => m.subject);
  return `asuntos recibidos: ${subjects.join(" | ")}`;
});

await step("/bienvenida del comercio (captura)", async () => {
  const { page } = comercio;
  await page.bringToFront();
  await page.getByText("Nombre del comercio").first().waitFor({ timeout: 15000 });
  shots.bienvenida = await comercio.shot("03-bienvenida-comercio");
  return shots.bienvenida;
});

await step("buscador de direcciones (Nominatim simulado) + mapa base", async () => {
  const { page } = comercio;
  await page.getByPlaceholder("Ej: Bar El Patio").fill("Bar Humo E1");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const search = page.getByPlaceholder("Buscá la dirección de tu local");
  await search.waitFor({ timeout: 20000 });
  await search.fill("Gorriti 4800");
  const result = page.getByRole("button", { name: /4800, Gorriti, Palermo/ });
  await result.first().waitFor({ timeout: 15000 });
  const count = await page.locator("ul li button").count();
  shots.geocoder = await comercio.shot("04-geocoder-resultados");
  await result.first().click();
  await page.locator("canvas").first().waitFor({ timeout: 20000 });
  await sleep(1200);
  shots.mapaPicker = await comercio.shot("05-mapa-direccion-elegida");
  // Sin resultados: el estado vacío del buscador.
  await search.fill("zzzz");
  await page.getByText("No encontramos esa dirección").waitFor({ timeout: 15000 });
  await search.fill("Gorriti 4800");
  await result.first().waitFor({ timeout: 15000 });
  await result.first().click();
  await page.getByRole("button", { name: "Terminar", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/shifts"), { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  shots.panel = await comercio.shot("06-panel-comercio");
  const profile = db(`select c.name, c.address, c.city, c.latitude from company_profiles c join users u on u.id = c.user_id where u.email = '${comercioEmail}'`);
  assert(profile[0]?.address, `no se guardó la dirección: ${JSON.stringify(profile)}`);
  return `${count} resultados · guardado: ${profile[0].address} / ${profile[0].city}`;
});

// ── 2. Trabajador: API → login por UI → feed → foto → mapa → refresh ────────
const trabajador = await open({ name: "smoke-trabajador", geo: { lat: -34.5875, lng: -58.4300 } });
let worker;

await step("registerViaApi(worker) deja la cuenta lista", async () => {
  worker = await registerViaApi({ role: "worker", email: uniq("smoke-mozo"), fullName: "Mora Humo" });
  const me = await api("GET", "/auth/me", { token: worker.token });
  assert(me.ok && me.data.is_verified === true, `auth/me: ${me.status} ${JSON.stringify(me.data)}`);
  const profile = await api("GET", "/workers/me/profile", { token: worker.token });
  assert(profile.ok && profile.data.skills.length > 0, `perfil: ${profile.status}`);
  const terms = db(`select count(*) as n from terms_acceptances t join users u on u.id = t.user_id where u.email = '${worker.email}'`);
  assert(terms[0]?.n === "1", `constancia de términos: ${JSON.stringify(terms)}`);
  return `${worker.email} · verificado · términos aceptados · perfil con ${profile.data.skills.join(", ")}`;
});

await step("login por la UI → /feed con turnos demo", async () => {
  const { page } = trabajador;
  const landed = await loginAs(page, worker);
  await page.waitForURL("**/feed", { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(800);
  const text = await page.evaluate(() => document.body.innerText);
  assert(/Palermo|Recoleta|Villa Crespo/.test(text), "el feed no muestra turnos demo");
  shots.feed = await trabajador.shot("07-feed-trabajador");
  return `aterrizó en ${new URL(landed).pathname}`;
});

await step("cookie del refresh (Secure + SameSite=None) funciona sobre http://localhost", async () => {
  const { page, context } = trabajador;
  const cookies = await context.cookies(`${BACKEND}/api/v1/auth/refresh`);
  const refresh = cookies.find((c) => c.name === "staffya_refresh");
  assert(refresh, "el navegador no guardó la cookie staffya_refresh");
  assert(refresh.secure && refresh.httpOnly && refresh.sameSite === "None", `atributos: ${JSON.stringify({ secure: refresh.secure, httpOnly: refresh.httpOnly, sameSite: refresh.sameSite })}`);
  // Sin access token y con la marca de sesión: la app tiene que renovarse sola con la cookie.
  await page.evaluate(() => window.localStorage.removeItem("staffya_token"));
  const refreshed = page.waitForResponse((r) => r.url().endsWith("/auth/refresh") && r.request().method() === "POST", { timeout: 20000 });
  await page.reload();
  const response = await refreshed;
  assert(response.status() === 200, `POST /auth/refresh → ${response.status()}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  assert(new URL(page.url()).pathname === "/feed", `tras renovar quedó en ${page.url()}`);
  return "POST /auth/refresh 200 con la cookie; la sesión siguió en /feed";
});

await step("foto de perfil pasa por el Cloudinary simulado", async () => {
  const { page } = trabajador;
  await page.goto("/profile");
  const input = page.locator('input[type="file"][accept^="image"]').first();
  await input.waitFor({ state: "attached", timeout: 20000 });
  const upload = waitForUpload(page);
  await input.setInputFiles(assets.foto);
  // El producto pide encuadrar antes de subir (ImageCropModal).
  await page.getByRole("button", { name: "Usar esta foto", exact: true }).click();
  const { status, body } = await upload;
  assert(status === 200, `subida → ${status} ${JSON.stringify(body)}`);
  assert(/^https:\/\/res\.cloudinary\.com\/oido-e1\/image\/upload\/v\d+\/oido\/perfiles\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(body.secure_url), `secure_url: ${body.secure_url}`);
  const img = page.locator('img[src*="res.cloudinary.com/oido-e1"]').first();
  await img.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('img[src*="res.cloudinary.com/oido-e1"]');
    return el && el.complete && el.naturalWidth > 0;
  }, null, { timeout: 15000 });
  const natural = await img.evaluate((el) => `${el.naturalWidth}×${el.naturalHeight}`);
  shots.foto = await trabajador.shot("08-foto-de-perfil");
  return `${body.public_id} (${body.bytes} bytes) · la imagen se ve (${natural})`;
});

await step("mapa del trabajador: estilo simulado + pines", async () => {
  const { page } = trabajador;
  await page.goto("/map");
  await page.locator("canvas.maplibregl-canvas, canvas").first().waitFor({ timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(2500);
  const markers = await page.locator(".maplibregl-marker").count();
  shots.mapa = await trabajador.shot("09-mapa-trabajador");
  assert(markers > 0, "el mapa cargó pero no dibujó ningún pin (¿no llegó el evento load?)");
  return `${markers} marcadores en el DOM`;
});

// ── 3. Admin con verificación en dos pasos ──────────────────────────────────
let adminS;
await step("adminSession(n=1) → /admin", async () => {
  adminS = await adminSession(browser, { n: 1, viewport: "mobile", theme: "light", name: "smoke-admin" });
  sessions.push(adminS);
  const { page } = adminS;
  await page.goto("/admin");
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(800);
  assert(new URL(page.url()).pathname.startsWith("/admin"), `quedó en ${page.url()}`);
  const text = await page.evaluate(() => document.body.innerText);
  assert(text.length > 200 && !/Verificación en dos pasos\s*\n\s*Escribí el código/.test(text), "el panel de admin no cargó");
  shots.admin = await adminS.shot("10-admin");
  assert(/^\d{6}$/.test(totpNow(1)), "totpNow(1) no devolvió 6 dígitos");
  const list = admins();
  assert(list.length === 9 && list.filter((a) => a.enrolled).length === 8 && list[8].enrolled === false, "admin.json no tiene 8 con 2FA + admin9 sin alta");
  return `admin1 adentro · admin.json: 8 con 2FA, admin9 sin alta`;
});

await step("documentos privados: DNI + selfie por la UI → el admin los ve con el link que vence", async () => {
  const { page } = trabajador;
  await page.goto("/profile");
  const files = page.locator('input[type="file"][accept^="image"]');
  await files.nth(1).waitFor({ state: "attached", timeout: 20000 });
  for (const [index, file] of [[1, assets.dniFrente], [2, assets.selfie]]) {
    const uploaded = waitForUpload(page);
    await files.nth(index).setInputFiles(file);
    const { body } = await uploaded;
    assert(body?.type === "private" && /^oido\/identidad\/[0-9a-f]{32}$/.test(body.public_id), `subida privada: ${JSON.stringify(body).slice(0, 300)}`);
    assert(body.bytes > 10000, `el archivo llegó vacío o cortado al simulado (${body.bytes} bytes)`);
  }
  const submitted = page.waitForResponse((r) => r.url().endsWith("/identity/me/document") && r.request().method() === "POST", { timeout: 20000 });
  await page.getByRole("button", { name: "Enviar a revisión", exact: true }).click();
  const res = await submitted;
  assert(res.status() < 300, `enviar a revisión → ${res.status()} ${await res.text().catch(() => "")}`);

  // El original privado NO se entrega por res.cloudinary.com.
  const ref = db(`select e.file_public_id as id from identity_evidences e join identity_claims c on c.id = e.claim_id join users u on u.id = c.user_id where u.email = '${worker.email}' limit 1`);
  const direct = await fetch(`http://127.0.0.1:8901/res/oido-e1/image/private/${ref[0]?.id}.jpg`);
  assert(direct.status === 401, `el archivo privado se pudo bajar por la URL pública (${direct.status})`);

  const admin = adminS.page;
  await admin.goto("/admin/verificacion");
  const evidence = admin.locator('img[src*="api.cloudinary.com/v1_1/oido-e1/image/download"]');
  await evidence.first().waitFor({ timeout: 20000 });
  await admin.waitForFunction(() => [...document.querySelectorAll('img[src*="/image/download"]')].some((el) => el.complete && el.naturalWidth > 0), null, { timeout: 15000 });
  shots.verificacion = await adminS.shot("13-admin-verificacion");
  return `${await evidence.count()} evidencias visibles para el admin; URL pública del privado → 401`;
});

await step("captación de comercios: importar un barrio (Overpass simulado)", async () => {
  const token = await adminApiToken(2);
  const res = await api("POST", "/admin/leads/import", { token, body: { barrio: "Palermo" } });
  assert(res.ok, `importar → ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return JSON.stringify(res.data);
});

// ── 4. Google simulado ──────────────────────────────────────────────────────
const googleEmail = uniq("smoke-google");
const google = await open({ name: "smoke-google", googleUser: { email: googleEmail, name: "Gloria Humo" } });

await step("botón de Google simulado da de alta una cuenta", async () => {
  const { page } = google;
  await page.goto("/login");
  const button = page.locator("[data-e1-google]");
  await button.waitFor({ timeout: 20000 });
  shots.login = await google.shot("11-login-con-google-simulado");
  await button.click();
  await page.getByText("¿Buscás trabajo o buscás personal?").waitFor({ timeout: 15000 });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Busco trabajo", exact: true }).click();
  await page.waitForURL("**/bienvenida", { timeout: 20000 });
  await page.getByText("¿Dónde querés trabajar?").waitFor({ timeout: 15000 });
  shots.googleBienvenida = await google.shot("12-bienvenida-google");
  const row = db(`select role, is_verified from users where email = '${googleEmail}'`);
  assert(row[0]?.role === "worker" && row[0]?.is_verified === "t", `fila: ${JSON.stringify(row)}`);
  const welcome = await waitForMail(googleEmail, { subject: /Bienvenid/i });
  return `${googleEmail} creada como trabajador verificado · llegó «${welcome.subject}»`;
});

await step("Google por API: token inválido 401, otro `aud` 401", async () => {
  const bad = await api("POST", "/auth/google", { body: { id_token: "no-es-un-token" } });
  assert(bad.status === 401, `token inválido → ${bad.status}`);
  const otherAud = await api("POST", "/auth/google", { body: { id_token: googleCredential({ email: uniq("smoke-aud"), aud: "otra-app.apps.googleusercontent.com" }) } });
  assert(otherAud.status === 401, `aud ajeno → ${otherAud.status}`);
  return "el verificador real rechaza lo que tiene que rechazar";
});

// ── 5. IA simulada, push simulado, db() ─────────────────────────────────────
await step("IA simulada: parse-text por la API real", async () => {
  const employer = await registerViaApi({ role: "employer", email: uniq("smoke-ia") });
  const res = await api("POST", "/shifts/parse-text", { token: employer.token, body: { text: "necesito un bartender mañana de 20 a 2, pago 15 mil" } });
  assert(res.ok, `parse-text → ${res.status} ${JSON.stringify(res.data)}`);
  const d = res.data;
  // "Mañana" se resuelve contra el HOY de Argentina que el backend le pasa al modelo.
  const art = (offsetDays) => new Date(Date.now() - 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
  assert(
    d.position === "bartender" && Number(d.pay_amount) === 15000 && d.start_at === `${art(1)}T20:00:00-03:00` && d.end_at === `${art(2)}T02:00:00-03:00` && d.missing.length === 0,
    `borrador: ${JSON.stringify(d)}`
  );
  const partial = await api("POST", "/shifts/parse-text", { token: employer.token, body: { text: "necesito 2 mozos el sábado a la noche" } });
  assert(partial.ok && partial.data.missing.length >= 2, `faltantes: ${JSON.stringify(partial.data)}`);
  const down = await api("POST", "/shifts/parse-text", { token: employer.token, body: { text: "mozo hoy E1_IA_CAIDA" } });
  return `completo ok · faltantes: ${partial.data.missing.join(", ")} · con E1_IA_CAIDA → ${down.status}`;
});

await step("push simulado: una postulación dispara un push al comercio", async () => {
  const employer = await registerViaApi({ role: "employer", email: uniq("smoke-push") });
  const key = await api("GET", "/push/public-key", { token: employer.token });
  assert(key.ok && key.data.vapid_public_key, `clave pública: ${JSON.stringify(key.data)}`);
  const sub = fakePushSubscription("smoke");
  const res = await api("POST", "/push/subscribe", { token: employer.token, body: sub });
  assert(res.ok, `suscribir → ${res.status} ${JSON.stringify(res.data)}`);
  const start = new Date(Date.now() + 26 * 3600e3);
  const shift = await api("POST", "/shifts", {
    token: employer.token,
    body: {
      position: "mozo", start_at: start.toISOString(), end_at: new Date(start.getTime() + 6 * 3600e3).toISOString(),
      pay_amount: 40000, tips: true, address: "Gorriti 5000", city: "Palermo", latitude: -34.58755, longitude: -58.43095,
    },
  });
  assert(shift.ok, `crear turno → ${shift.status} ${JSON.stringify(shift.data).slice(0, 300)}`);
  if (shift.data.status === "borrador") {
    const published = await api("POST", `/shifts/${shift.data.id}/publish`, { token: employer.token });
    assert(published.ok, `publicar → ${published.status} ${JSON.stringify(published.data).slice(0, 300)}`);
  }
  const applied = await api("POST", `/applications/shifts/${shift.data.id}`, { token: await apiLogin(worker), body: {} });
  assert(applied.ok, `postularse → ${applied.status} ${JSON.stringify(applied.data).slice(0, 300)}`);
  let sent = [];
  for (let i = 0; i < 40 && !sent.length; i++) {
    await sleep(250);
    sent = await pushOutbox(sub.endpoint);
  }
  const notes = await api("GET", "/notifications", { token: employer.token });
  assert(sent.length > 0, `no salió ningún push (notificaciones del comercio: ${JSON.stringify(notes.data).slice(0, 300)})`);
  return `${sent.length} push hacia la suscripción del comercio (cifrado, ${sent[0].bytes} bytes) · aviso: «${notes.data?.[0]?.title ?? "?"}»`;
});

await step("IA simulada: asistente del comercio, del trabajador y sugerencia de soporte", async () => {
  const employer = await registerViaApi({ role: "employer", email: uniq("smoke-asist") });
  const event = await api("POST", "/assistant/query", { token: employer.token, body: { text: "necesito 1 bachero, 1 bartender y 2 mozos para el sábado de 20 a 2" } });
  assert(event.ok, `assistant/query → ${event.status} ${JSON.stringify(event.data).slice(0, 300)}`);
  const workerQuery = await api("POST", "/assistant/worker-query", { token: await apiLogin(worker), body: { text: "buscame un turno de mozo en Palermo a menos de 2 km para hoy" } });
  assert(workerQuery.ok, `assistant/worker-query → ${workerQuery.status} ${JSON.stringify(workerQuery.data).slice(0, 300)}`);
  return `comercio: ${JSON.stringify(event.data).slice(0, 140)}… · trabajador: ${JSON.stringify(workerQuery.data).slice(0, 140)}…`;
});

// ── 6. Tema oscuro y escritorio ─────────────────────────────────────────────
await step("sesión desktop + dark: tema fijado antes del primer render", async () => {
  const dark = await newSession(browser, { name: "smoke-dark", viewport: "desktop", theme: "dark" });
  sessions.push(dark);
  const seen = [];
  await dark.page.exposeFunction("__smokeTheme", (value) => seen.push(value));
  await dark.page.addInitScript(() => {
    new MutationObserver(() => window.__smokeTheme(document.documentElement?.getAttribute("data-theme"))).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
  });
  await dark.page.goto("/login");
  await dark.page.locator("[data-e1-google]").waitFor({ timeout: 20000 });
  const state = await dark.page.evaluate(() => ({ theme: document.documentElement.getAttribute("data-theme"), width: window.innerWidth, bg: getComputedStyle(document.body).backgroundColor }));
  assert(state.theme === "dark" && !seen.includes("light"), `tema final ${state.theme}; valores vistos: ${JSON.stringify(seen)}`);
  assert(state.width === 1280, `ancho ${state.width}`);
  shots.dark = await dark.shot("14-login");
  assert(/14-login_1280_dark\.png$/.test(shots.dark), `nombre de captura: ${shots.dark}`);
  return `nunca pasó por claro (${JSON.stringify(seen)}), ${state.width}px, fondo ${state.bg}`;
});

// ── Cierre: logs de sesión ──────────────────────────────────────────────────
console.log("\nLogs de sesión:");
for (const s of sessions) {
  const summary = s.log.summary();
  const bad = s.log.of("external-unrouted", "csp", "pageerror", "fake-error");
  console.log(`  ${s.name}: ${JSON.stringify(summary)}`);
  for (const entry of s.log.problems().slice(0, 12)) {
    console.log(`      · ${entry.type}: ${(entry.status ? entry.status + " " : "") + (entry.url || entry.text || "").slice(0, 160)}`);
  }
  if (bad.length) {
    failed = true;
    console.log(`      ✗ ${bad.length} entradas que el arnés no debería producir (external-unrouted / csp / pageerror / fake-error)`);
  }
  await s.close();
}
await browser.close();

// ── Limpieza: lo que creó esta corrida no queda en la base ──────────────────
await step("limpieza de las cuentas smoke-*", async () => {
  db(`delete from notifications n using shifts s, company_profiles c, users u
      where s.company_id = c.id and c.user_id = u.id and u.email like 'smoke-%@e1.test' and n.link like '%' || s.id::text || '%'`);
  const before = db("select count(*) as n from users where email like 'smoke-%@e1.test'")[0].n;
  db("delete from users where email like 'smoke-%@e1.test'");
  db("delete from leads where name like '% (Palermo)' and status = 'nuevo'");
  return `${before} cuentas de humo borradas (con sus turnos, postulaciones y avisos)`;
});

fs.mkdirSync(path.join(E1, "results"), { recursive: true });
fs.writeFileSync(path.join(E1, "results", "smoke-result.json"), JSON.stringify({ at: new Date().toISOString(), ok: !failed, results, shots }, null, 2));
console.log(`\nCapturas:\n${Object.values(shots).map((f) => "  " + f).join("\n")}`);
console.log(failed ? "\nSMOKE: FALLÓ" : "\nSMOKE: OK");
process.exit(failed ? 1 : 0);
