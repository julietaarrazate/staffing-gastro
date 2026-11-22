const { abrir, foto, listo, APP_URL } = require('./lib');
(async () => {
  for (const [nombre, h, ruta] of [['l-landing-chrome', 732, '/'], ['l-landing-safari', 720, '/'], ['l-landing-app', 844, '/'], ['l-registro', 844, '/register'], ['l-registro-comercio', 844, '/register?rol=comercio']]) {
    const { b, p } = await abrir({ rol: 'anon', h });
    await p.goto(APP_URL + ruta); await listo(p);
    await foto(p, nombre, { espera: 2500 });
    if (nombre === 'l-landing-app') await foto(p, nombre + '-full', { full: true });
    console.log('sin manejar:', [...p.sinManejar].join(' | '));
    await b.close();
  }
})();
