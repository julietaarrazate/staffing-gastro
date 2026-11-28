// Dibuja la pieza cuadro por cuadro en Chromium sin placa de video (SwiftShader).
// Uso: node render.js <escena> <desde s> <hasta s> <carpeta> [ancho=720] [alto=1280] [fps=30] [cada=1] [sub=auto] [trabajador=0/1]
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const [,, escena = 'pieza', desde = '0', hasta = '10', salida = 'trabajo/cuadros', ancho = '720', alto = '1280', fpsA = '30', cadaA = '1', subA = 'auto', trab = '0/1'] = process.argv;
const RAIZ = path.resolve(__dirname, '..'), fps = +fpsA, cada = +cadaA, [ti, tn] = trab.split('/').map(Number);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const MARCA = path.resolve(__dirname, '../../docs/design-system/marca');
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = u.startsWith('/marca/') ? path.join(MARCA, u.slice(7)) : path.join(RAIZ, u); if (!(f.startsWith(RAIZ) || f.startsWith(MARCA)) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  fs.mkdirSync(salida, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +ancho, height: +alto }, deviceScaleFactor: 1 }); p.setDefaultTimeout(0);
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('consola', m.type(), m.text().slice(0, 400)); });
  await p.goto(`http://127.0.0.1:${port}/pieza-falta-uno/pieza.html?w=${ancho}&h=${alto}&escena=${escena}`);
  await p.waitForFunction(() => window.listo === true);
  const f0 = Math.round(+desde * fps), f1 = Math.round(+hasta * fps), t0 = Date.now(); let n = 0;
  for (let f = f0; f < f1; f += cada) {
    if (((f - f0) / cada) % tn !== ti) continue;
    const url = await p.evaluate(([t, sub]) => window.pieza.cuadro(t, sub === 'auto' ? {} : { sub: +sub }), [f / fps, subA]);
    fs.writeFileSync(path.join(salida, `c${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (++n % 10 === 0) console.log(`[${ti}] ${n} cuadros · ${((Date.now() - t0) / n / 1000).toFixed(2)} s por cuadro`);
  }
  console.log(`[${ti}] listo: ${n} cuadros en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  await b.close(); srv.close();
})();
