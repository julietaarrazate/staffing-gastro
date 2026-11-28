// Dibuja el pinche chico (marca fija de @turnosgastro) en PNG transparente. Uso: node marca.js <svg> <salida.png> [lado=84]
const { chromium } = require('playwright'); const fs = require('fs');
const [,, svg, sal, lado = '84'] = process.argv;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +lado, height: +lado }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${fs.readFileSync(svg).toString('base64')}" style="width:${lado}px;height:${lado}px;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))"></body></html>`);
  await p.screenshot({ path: sal, omitBackground: true }); await b.close(); console.log('marca', sal);
})();
