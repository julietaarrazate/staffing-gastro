// Captura cuadros sueltos con la API de prueba de la presentación (test.seek / test.trans). Uso: node capturar.js <archivo.html> <carpeta> "id:paso:segundo,…|T:id:avance" [px] [ancho] [alto]
const { chromium } = require('playwright'); const fs = require('fs');
const [,, file, outDir, spec, px = '0.5', vw = '960', vh = '540'] = process.argv; // spec: "id:beat:t,id:beat:t" | "T:id:p"
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +vw, height: +vh }, deviceScaleFactor: 1 });
  p.setDefaultTimeout(600000);
  const logs = [];
  p.on('console', m => { const t = m.text(); if (!/GPU stall|GL Driver/.test(t)) logs.push(m.type()+': '+t.slice(0,300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: '+String(e.stack||e).slice(0,500)));
  await p.goto('file://' + file + '?headless&quick&px=' + px);
  const t0 = Date.now();
  await p.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
  console.log('ready in', ((Date.now()-t0)/1000).toFixed(1)+'s');
  let n = 0;
  for (const it of spec.split(',')) {
    const a = it.split(':'); const t1 = Date.now(); let name;
    if (a[0] === 'T') { await p.evaluate(([id, pp]) => window.__deck.test.trans(id, +pp), [a[1], a[2]]); name = `T_${a[1]}_${a[2]}`; }
    else { await p.evaluate(([id, beat, t]) => window.__deck.test.seek(id, +beat, +t), a); name = `${a[0]}_${a[1]}_${a[2]}`; }
    const url = await p.evaluate(() => document.getElementById('stage').toDataURL('image/jpeg', .85));
    fs.writeFileSync(`${outDir}/${String(n++).padStart(2,'0')}_${name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(name, ((Date.now()-t1)/1000).toFixed(1)+'s');
  }
  console.log(logs.slice(0, 12).join('\n'));
  await b.close();
})();
