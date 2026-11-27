// Pasada rápida sin dibujar: deja que la presentación avance sola y anota en qué cuadro cambia cada escena y cada paso. Uso: node linea.js <render.html> <linea.json>
const { chromium } = require('playwright'); const fs = require('fs');
const [,, file, out] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); p.setDefaultTimeout(1200000);
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  await p.goto('file://' + file + '?quick&px=0.25');
  await p.waitForFunction(() => window.ready === true);
  const t0 = Date.now();
  const log = await p.evaluate(async () => {
    const d = window.__deck; d.test.tick(0); await d.warmAll(); await d.test.seek('office', 0, 0); d.setAuto(true);
    const ids = d.scenes.map(s => s.id), log = []; let prev = '';
    const ch = new MessageChannel(); const cede = () => new Promise(r => { ch.port1.onmessage = r; ch.port2.postMessage(0); });
    for (let f = 0; f < 20000; f++) { d.test.tick(1 / 30); await cede(); const s = d.test.state(), key = s.g + '|' + s.beat + '|' + (s.tr ? s.tr.name + '>' + s.tr.to : '');
      if (key !== prev) { prev = key; log.push({ f, t: +(f / 30).toFixed(2), scene: ids[s.g], beat: s.beat, tr: s.tr ? s.tr.name + '→' + ids[s.tr.to] : '' }); }
      if (!s.auto) { log.push({ f, t: +(f / 30).toFixed(2), fin: true }); break; } }
    return log;
  });
  fs.writeFileSync(out, JSON.stringify(log, null, 1)); console.log('tardó', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'eventos', log.length);
  for (const e of log) console.log(String(e.t).padStart(7), (e.scene || '').padEnd(10), e.beat ?? '', e.tr || '', e.fin ? 'FIN' : '');
  await b.close();
})();
