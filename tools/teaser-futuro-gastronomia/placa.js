// La placa final con la marca: el cielo, la firma fileteada y la dirección.
const { chromium } = require('playwright'); const fs = require('fs');
const [,, svg, fYoung, fMono, out, W, H] = process.argv; // firma fileteada, Young Serif y DM Mono 500 (woff2), salida y tamaño
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const f = (n, file, w) => `@font-face{font-family:"${n}";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')})}`;
  const P = +H > +W, u = Math.min(+W, +H) / 1080;
  await p.setContent(`<style>${f('Young Serif', fYoung, 400)}${f('DM Mono', fMono, 500)}
    body{margin:0;width:${W}px;height:${H}px;background:linear-gradient(#5BA8E0,#84C0EC 50%,#BFE1F6);display:grid;place-content:center;justify-items:center;gap:${44 * u}px;overflow:hidden}
    h1{margin:0;font:400 ${(P ? 88 : 92) * u}px "Young Serif",serif;color:#0F3A5B;text-align:center;line-height:1.05}
    img{width:${(P ? 760 : 620) * u}px} p{margin:0;font:500 ${(P ? 44 : 40) * u}px "DM Mono",monospace;color:#0F3A5B} small{font:500 ${(P ? 26 : 24) * u}px "DM Mono",monospace;letter-spacing:.12em;color:#1C5478}</style>
    <h1>¿Te falta alguien hoy?</h1><img src="data:image/svg+xml;base64,${fs.readFileSync(svg).toString('base64')}"><p>www.oido.com.ar</p><small>BETA EN PALERMO · BUENOS AIRES</small>`);
  await p.waitForTimeout(600); await p.screenshot({ path: out }); await b.close(); console.log('placa', out);
})();
