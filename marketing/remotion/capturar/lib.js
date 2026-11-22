// Arnés de captura: la app real (next start en APP_URL) con la API mockeada
// como en frontend/e2e (page.route), respuestas armadas sobre el contrato real.
// Usa el Playwright y el contrato de frontend/ (hace falta `npm ci` ahí).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const APP = path.resolve(__dirname, '../../../frontend');
const { chromium } = require(path.join(APP, 'node_modules/playwright'));
const respuestas = require(path.join(APP, 'e2e/contrato/respuestas.json'));

const APP_URL = process.env.APP_URL || 'http://localhost:3311';
const OUT = path.resolve(__dirname, '../capturas');  // ignorada en git
const CACHE = path.resolve(__dirname, '.cache');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// Viernes 27/11/2026, hora de Buenos Aires (el «viernes a las 19»).
const DIA = '2026-11-27';
const iso = (hora, dias = 0) => {
  const d = new Date(`${DIA}T${hora}:00-03:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().replace('.000Z', '+00:00');
};

function real(n) { return structuredClone(respuestas[n].body); }
function deContrato(n, cambios) {
  const base = real(n);
  const molde = Array.isArray(base) ? base[0] : base;
  const fundir = (obj) => {
    for (const k of Object.keys(obj)) if (!(k in molde)) throw new Error(`${n}: la clave ${k} no existe en el contrato`);
    return { ...structuredClone(molde), ...obj };
  };
  return Array.isArray(cambios) ? cambios.map(fundir) : fundir(cambios);
}

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function abrir({ theme = 'light', rol = 'worker', ahora = iso('19:00'), dsf = 3, w = 390, h = 844, me, reloj = false } = {}) {
  const b = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome') ? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' : undefined), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('pageerror', e.message.slice(0, 200)));
  if (ahora && reloj) await p.clock.install({ time: new Date(ahora) });
  else if (ahora) await p.clock.setFixedTime(new Date(ahora));
  await p.addInitScript(({ theme, sesion }) => {
    if (sesion) {
      localStorage.setItem('staffya_token', 'e2e-fake-access-token');
      localStorage.setItem('staffya_has_session', '1');
    }
    for (const k of ['staffya_tour_worker_feed', 'staffya_tour_employer_panel']) localStorage.setItem(k, '1');
    localStorage.setItem('oido-theme', theme);
    sessionStorage.setItem('staffya_splash_seen', '1');
  }, { theme, sesion: rol !== 'anon' });
  // Mapa y fotos: CARTO por el proxy (con caché); lo demás de afuera, cortado.
  await p.route((u) => /cartocdn\.com$/.test(u.hostname), async (route) => {
    const url = route.request().url();
    const f = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));
    if (!fs.existsSync(f)) {
      const r = spawnSync('curl', ['-s', '-f', '--compressed', '-o', f, url]);
      if (r.status !== 0) return route.abort();
    }
    const ct = url.endsWith('.json') ? 'application/json' : url.endsWith('.png') ? 'image/png' : url.endsWith('.pbf') || url.endsWith('.mvt') ? 'application/x-protobuf' : 'application/octet-stream';
    route.fulfill({ path: f, contentType: ct, headers: { 'access-control-allow-origin': '*' } });
  });
  await p.route((u) => /loremflickr|pravatar|googletagmanager|google-analytics|accounts\.google|challenges\.cloudflare/.test(u.hostname), (r) => r.abort());
  // La API: catch-all y después lo específico (Playwright usa la última ruta registrada).
  const sinManejar = new Set();
  await p.route('**/api/v1/**', (r) => {
    const u = new URL(r.request().url());
    sinManejar.add(r.request().method() + ' ' + u.pathname);
    return r.fulfill(r.request().method() === 'GET' ? json([]) : json({}));
  });
  await p.route('**/api/v1/notifications**', (r) => r.fulfill(json([])));
  if (rol !== 'anon') {
    const base = rol === 'employer' ? real('auth_me_employer') : real('auth_me_worker');
    await p.route('**/api/v1/auth/me', (r) => r.fulfill(json({ ...base, ...(me || {}) })));
  }
  p.sinManejar = sinManejar;
  return { b, ctx, p };
}

async function foto(p, nombre, opts = {}) {
  await p.waitForTimeout(opts.espera ?? 300);
  const f = path.join(OUT, nombre + '.png');
  if (opts.full) {
    // Página entera sin la barra flotante (en el video la barra va encima, fija).
    const st = await p.addStyleTag({ content: '.barra-app{visibility:hidden!important}' });
    await p.screenshot({ path: f, fullPage: true });
    await st.evaluate((el) => el.remove());
    const st2 = await p.addStyleTag({ content: 'html,body{background:transparent!important} body *{visibility:hidden!important} .barra-app,.barra-app *{visibility:visible!important}' });
    await p.screenshot({ path: path.join(OUT, nombre.replace(/-full/, '') + '-barra.png'), omitBackground: true });
    await st2.evaluate((el) => el.remove());
  } else {
    await p.screenshot({ path: f, animations: opts.animations || 'allow' });
  }
  console.log('  ', nombre);
  return f;
}

async function listo(p) {
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState('networkidle').catch(() => {});
}

// Grabación real (screencast de Chrome): cuadros con su tiempo, para remuestrear a 30 fps.
async function grabar(p, nombre, accion, { ms = 3000 } = {}) {
  const dir = path.join(OUT, 'rec', nombre); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p);
  const cuadros = []; let t0 = null;
  cdp.on('Page.screencastFrame', async (f) => {
    const ts = f.metadata.timestamp; if (t0 === null) t0 = ts;
    cuadros.push({ t: ts - t0, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  const inicio = Date.now();
  if (accion) await accion();
  const resto = ms - (Date.now() - inicio); if (resto > 0) await p.waitForTimeout(resto);
  await cdp.send('Page.stopScreencast');
  const idx = cuadros.map((c, i) => { const f = `${String(i).padStart(4, '0')}.jpg`; fs.writeFileSync(path.join(dir, f), Buffer.from(c.data, 'base64')); return { f, t: +c.t.toFixed(3) }; });
  fs.writeFileSync(path.join(dir, 'cuadros.json'), JSON.stringify(idx));
  console.log('  rec', nombre, idx.length, 'cuadros en', idx.length ? idx[idx.length - 1].t.toFixed(2) : 0, 's');
}

// Cuadro a cuadro con el reloj de la página (rAF, timers, Date) en pausa:
// cada cuadro avanza 1/30 s. Sirve para el mapa (MapLibre anima con rAF).
// Las animaciones CSS se frenan a la vez con el playbackRate de CDP.
async function cuadroACuadro(p, nombre, { n = 60, antes, ahoraMs } = {}) {
  const dir = path.join(OUT, 'rec', nombre); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await p.clock.pauseAt(new Date(ahoraMs));
  if (antes) await antes();
  for (let i = 0; i < n; i++) {
    await p.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
    await p.clock.runFor(1000 / 30);
  }
  fs.writeFileSync(path.join(dir, 'cuadros.json'), JSON.stringify(Array.from({ length: n }, (_, i) => ({ f: `${String(i).padStart(4, '0')}.jpg`, t: i / 30 }))));
  console.log('  cuadros', nombre, n);
}

module.exports = { cuadroACuadro, grabar,  abrir, foto, listo, json, deContrato, real, iso, DIA, OUT, APP_URL };
