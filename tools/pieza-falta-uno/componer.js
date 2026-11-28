// Compone las fotos para redes: la imagen del mundo 3D con una frase en la letra de la marca. Uso: node componer.js <lista.json> <carpeta salida>
// lista: [{ "fondo": "ruta.jpg", "sal": "nombre.png", "w": 1080, "h": 1350, "titulo": "…", "bajada": "…", "lugar": "abajo|arriba|ninguno" }]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [,, listaF, salDir] = process.argv;
const b64 = f => fs.readFileSync(f).toString('base64');
const serif = b64(path.join(__dirname, '../teaser-futuro-gastronomia/fuentes/young-serif.woff2')), inter = b64(path.join(__dirname, 'fuentes/inter.woff2'));
(async () => {
  const lista = JSON.parse(fs.readFileSync(listaF, 'utf8')); fs.mkdirSync(salDir, { recursive: true });
  const b = await chromium.launch();
  for (const it of lista) {
    const p = await b.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 1 });
    const arriba = it.lugar === 'arriba', sin = it.lugar === 'ninguno';
    await p.setContent(`<html><head><style>
      @font-face{font-family:YS;src:url(data:font/woff2;base64,${serif})} @font-face{font-family:IN;src:url(data:font/woff2;base64,${inter});font-weight:300 700}
      html,body{margin:0;width:${it.w}px;height:${it.h}px;overflow:hidden;background:#0b1424}
      .f{position:absolute;inset:0;background:url(data:image/jpeg;base64,${b64(it.fondo)}) center/cover}
      .v{position:absolute;inset:0;background:${sin ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 38%, rgba(5,10,20,.45) 75%)' : arriba ? 'linear-gradient(180deg, rgba(5,10,20,.78) 0%, rgba(5,10,20,0) 42%)' : 'linear-gradient(0deg, rgba(5,10,20,.82) 0%, rgba(5,10,20,0) 46%)'}}
      .t{position:absolute;left:84px;right:84px;${arriba ? 'top:110px' : 'bottom:120px'};color:#f4eee3;text-shadow:0 4px 30px rgba(0,0,0,.5)}
      h1{font:400 92px/1.04 YS,serif;margin:0 0 26px;text-wrap:balance} p{font:500 34px/1.3 IN,sans-serif;margin:0;color:#e7dfd0;letter-spacing:.2px}
    </style></head><body><div class="f"></div><div class="v"></div>${sin ? '' : `<div class="t"><h1>${it.titulo}</h1>${it.bajada ? `<p>${it.bajada}</p>` : ''}</div>`}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(salDir, it.sal), type: it.sal.endsWith('.jpg') ? 'jpeg' : 'png', ...(it.sal.endsWith('.jpg') ? { quality: 94 } : {}) });
    await p.close(); console.log('listo', it.sal);
  }
  await b.close();
})();
