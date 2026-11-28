// Calcula la banda de sonido (sin tiempo real) y la guarda en WAV. Uso: node banda.js <salida.wav> [duración s=68] [pieza|pieza2]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [,, salida = 'trabajo/sonido.wav', dur = '68', cual = 'pieza', tango = '1'] = process.argv;
const RAIZ = path.resolve(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch(); const p = await b.newPage(); p.setDefaultTimeout(0);
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 400))); p.on('console', m => { if (m.type() === 'error') console.log('consola', m.text().slice(0, 300)); });
  await p.goto(`http://127.0.0.1:${srv.address().port}/pieza-falta-uno/sonido.html`); await p.waitForFunction(() => window.listo === true);
  const t0 = Date.now(); const b64 = await p.evaluate(([d, c, tg]) => window.banda(+d, c, +tg), [dur, cual, tango]);
  fs.mkdirSync(path.dirname(salida), { recursive: true }); fs.writeFileSync(salida, Buffer.from(b64, 'base64'));
  console.log('sonido listo:', salida, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await b.close(); srv.close();
})();
