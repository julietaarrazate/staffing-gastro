// Cajas (CSS) de lo que se toca o se resalta en cada pantalla, para el video.
const path = require('path');
const { abrir, listo, json, APP_URL } = require('./lib');
(async () => {
  const m = require('./comercio');
  const out = {};
  const box = async (p, k, loc) => { const b = await loc.first().boundingBox().catch(() => null); out[k] = b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  { const { b, p } = await m.comercio('light');
    await m.rutasPublicar(p);
    await p.goto(APP_URL + '/shifts/new'); await listo(p); await p.waitForTimeout(800);
    await box(p, 'pub.campo', p.getByPlaceholder('Ej: necesito un mozo el sábado a la noche, se paga 45000'));
    await p.getByPlaceholder('Ej: necesito un mozo el sábado a la noche, se paga 45000').fill('x');
    await box(p, 'pub.completar', p.getByRole('button', { name: 'Completar' }));
    await p.getByPlaceholder('Ej: necesito un mozo el sábado a la noche, se paga 45000').fill('Necesito un mozo hoy de 20 a 4, pago 65 mil');
    await p.getByRole('button', { name: 'Completar' }).click();
    await p.getByRole('heading', { name: '¿Dónde es?' }).waitFor(); await p.waitForTimeout(800);
    await box(p, 'donde.tarjeta', p.locator('.app-cielo').nth(1));
    await box(p, 'donde.pago', p.getByText('$65.000'));
    await box(p, 'donde.publicar', p.getByRole('button', { name: /Publicar/ }).last());
    await b.close(); }
  { const { b, p } = await m.comercio('light');
    await m.rutasCandidatos(p);
    await p.goto(APP_URL + '/shifts/shift-1/candidates'); await listo(p); await p.waitForTimeout(800);
    await box(p, 'cand.destacada', p.locator('[data-destacado]'));
    await box(p, 'cand.dl', p.locator('[data-destacado] dl'));
    await box(p, 'cand.tabReco', p.getByRole('button', { name: /Recomendados/ }));
    await p.getByRole('button', { name: /Recomendados/ }).click(); await p.waitForTimeout(800);
    await box(p, 'reco.destacada', p.locator('[data-destacado]'));
    await box(p, 'reco.dl', p.locator('[data-destacado] dl'));
    const dds = await p.locator('[data-destacado] dl > div').all();
    for (let i = 0; i < dds.length; i++) await box(p, 'reco.dato' + i, dds[i]);
    await box(p, 'reco.verif', p.locator('[data-destacado]').getByText('Identidad verificada'));
    await box(p, 'reco.elegir', p.getByRole('button', { name: 'Elegir a Sofía', exact: true }));
    await b.close(); }
  console.log(JSON.stringify(out));
  require('fs').writeFileSync(path.join(__dirname, 'cajas-comercio.json'), JSON.stringify(out, null, 0));
})();
