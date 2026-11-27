// Dibuja cuadro por cuadro los tramos pedidos de la presentación en modo «avanza sola», con el mismo reloj que la pasada de sonido. Uso: node cuadros.js <render.html> <carpeta> <ancho> <alto> <corte.json> [cuadros por segundo=30] [cada=1] [tramos sueltos: 0,3,…]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [,, file, outDir, vw, vh, segFile, fpsArg = '30', everyArg = '1', onlyArg = ''] = process.argv;
const fps = +fpsArg, every = +everyArg, all = JSON.parse(fs.readFileSync(segFile, 'utf8')), only = onlyArg ? onlyArg.split(',').map(Number) : null;
const segs = all.map((s, i) => ({ i, f0: Math.round(s[0] * fps), f1: Math.round(s[1] * fps), name: s[2] })).filter(s => !only || only.includes(s.i));
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 1 }); p.setDefaultTimeout(0);
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  let n = 0; const t0 = Date.now();
  await p.exposeFunction('guardar', (si, k, url) => { fs.writeFileSync(path.join(outDir, `s${String(si).padStart(2, '0')}_${String(k).padStart(5, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); if (++n % 60 === 0) console.log(n, 'cuadros', ((Date.now() - t0) / 60000).toFixed(1) + ' min'); });
  await p.goto('file://' + file + '?quick&px=1');
  await p.waitForFunction(() => window.ready === true);
  const log = await p.evaluate(async ({ segs, fps, every }) => {
    const d = window.__deck, c = document.getElementById('stage'), ch = new MessageChannel(), cede = () => new Promise(r => { ch.port1.onmessage = r; ch.port2.postMessage(0); });
    d.test.tick(0); await d.warmAll(); await d.test.seek('office', 0, 0); d.setAuto(true);
    const ids = d.scenes.map(s => s.id), log = [], last = Math.max(...segs.map(s => s.f1)), PRE = 10; let prev = '';
    for (let f = 0; f <= last; f++) {
      d.test.tick(1 / fps); await cede();
      const s = d.test.state(), key = s.g + '|' + s.beat + '|' + (s.tr ? s.tr.name + '>' + s.tr.to : ''); if (key !== prev) { prev = key; log.push([f, ids[s.g], s.beat, s.tr ? s.tr.name : '']); }
      const sg = segs.find(q => f >= q.f0 - PRE && f < q.f1); if (!sg) continue;
      d.test.draw(); if (f >= sg.f0 && (f - sg.f0) % every === 0) await window.guardar(sg.i, (f - sg.f0) / every, c.toDataURL('image/jpeg', .95));
    }
    return log;
  }, { segs, fps, every });
  fs.writeFileSync(path.join(outDir, 'eventos.json'), JSON.stringify(log));
  console.log('listo', n, 'cuadros en', ((Date.now() - t0) / 60000).toFixed(1), 'min');
  await b.close();
})();
