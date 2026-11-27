// Pasada de sonido: la presentación avanza sola en tiempo real, sin dibujar, y se graba lo que sale de su propio motor de audio. Uso: node sonido.js <render-audio.html> <sonido.webm>
const { chromium } = require('playwright'); const fs = require('fs');
const [,, file, outWebm] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 }); p.setDefaultTimeout(0);
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  p.on('console', m => { const t = m.text(); if (/error|warn/i.test(m.type()) && !/GPU stall|GL Driver/.test(t)) console.log('console', m.type(), t.slice(0, 200)); });
  const out = fs.createWriteStream(outWebm); let bytes = 0;
  await p.exposeFunction('audioChunk', b64 => { const buf = Buffer.from(b64, 'base64'); bytes += buf.length; out.write(buf); });
  await p.addInitScript(() => {
    window.__NODRAW = true; window.__NOPARK = true;
    const AC = window.AudioContext, conn = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...a) { if (this.context && dest === this.context.destination && this.context.__tap) conn.call(this, this.context.__tap, ...a); return conn.call(this, dest, ...a); };
    window.AudioContext = class extends AC { constructor(o) { super(o); this.__tap = this.createMediaStreamDestination(); this.__conn = conn; window.__actx = this; } };
  });
  await p.goto('file://' + file + '?quick&px=0.25');
  await p.waitForFunction(() => window.ready === true);
  const t0 = Date.now();
  const res = await p.evaluate(async () => {
    const d = window.__deck, ch = new MessageChannel(), cede = () => new Promise(r => { ch.port1.onmessage = r; ch.port2.postMessage(0); }), wait = ms => new Promise(r => setTimeout(r, ms));
    d.test.tick(0); await d.warmAll(); await d.test.seek('office', 0, 0);
    d.audio.unlock(); for (let i = 0; i < 100 && !(window.__actx && window.__actx.state === 'running'); i++) { await wait(100); if (window.__actx && window.__actx.state !== 'running') window.__actx.resume().catch(() => {}); }
    const ctx = window.__actx; if (!ctx || ctx.state !== 'running') return { error: 'sin audio: ' + (ctx ? ctx.state : 'no hay contexto') };
    await wait(1500); const tb0 = performance.now(); if (window.__BANK) { window.__BANK.all(); if (window.__ENG) window.__ENG.ready(); } const bankMs = Math.round(performance.now() - tb0); await wait(1500);
    const rec = new MediaRecorder(ctx.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 }); let pend = Promise.resolve();
    rec.ondataavailable = e => { pend = pend.then(async () => { const u = new Uint8Array(await e.data.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); await window.audioChunk(btoa(s)); }); };
    rec.start(1000); await wait(300);
    // marca de sincronía: un pitido corto, un segundo antes del cuadro cero
    const tb = ctx.currentTime + .6, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1000; g.gain.value = .6; ctx.__conn.call(o, g); ctx.__conn.call(g, ctx.__tap); o.start(tb); o.stop(tb + .03);
    const tz = tb + 1, ids = d.scenes.map(s => s.id), log = [], lags = []; let k = 0, prev = '', fin = false, maxLag = 0;
    d.setAuto(true);
    while (!fin) {
      const el = ctx.currentTime - tz; let n = 0;
      while (k / 30 <= el && !fin) { d.test.tick(1 / 30); k++; await cede(); if (++n > maxLag) maxLag = n; if (n >= 3) lags[lags.length - 1] && lags[lags.length - 1][0] > k - 40 ? lags[lags.length - 1][1] = Math.max(lags[lags.length - 1][1], n) : lags.push([k, n]);
        const s = d.test.state(), key = s.g + '|' + s.beat + '|' + (s.tr ? s.tr.name + '>' + s.tr.to : ''); if (key !== prev) { prev = key; log.push([k - 1, ids[s.g], s.beat, s.tr ? s.tr.name : '']); }
        if (!s.auto) fin = true; }
      await wait(4);
    }
    await wait(3000); await new Promise(r => { rec.onstop = r; rec.stop(); }); await pend;
    return { log, k, maxLag, lags, bankMs, bank: window.__BANK ? window.__BANK.stats() : null, rate: ctx.sampleRate, err: String(d.audio && d.audio.err || '') };
  });
  await new Promise(r => out.end(r));
  fs.writeFileSync(outWebm + '.json', JSON.stringify(res));
  console.log('sonido listo en', ((Date.now() - t0) / 60000).toFixed(1), 'min ·', (bytes / 1e6).toFixed(1), 'MB ·', res.error || ('cuadros ' + res.k + ' · atraso máx ' + res.maxLag + ' cuadros · ' + res.rate + ' Hz'));
  await b.close();
})();
