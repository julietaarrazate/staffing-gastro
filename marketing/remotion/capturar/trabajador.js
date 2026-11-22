// Capturas del lado de quien trabaja: inicio, buscar (lista y mapa), postularse,
// te eligieron, confirmado, voy en camino, calificación, perfil.
const { OUT, cuadroACuadro, grabar, abrir, foto, listo, json, deContrato, real, iso, APP_URL } = require('./lib');

const CASA = { lat: -34.5900, lng: -58.4245 }; // zona del perfil (ejemplo)
const t = (id, position, company, lat, lng, extra = {}) => deContrato('feed', {
  id, position, company_name: company, latitude: lat, longitude: lng, city: 'Palermo', address: null,
  start_at: iso('20:00'), end_at: iso('02:00', 1), pay_amount: '65000.00', tips: true, urgent: false,
  published_at: iso('18:55'), company_verified: true, ...extra,
});
const FEED = [
  t('shift-1', 'mozo', 'Bar Lavalle', -34.5852, -58.4301, { urgent: true, end_at: iso('04:00', 1), tips: false, meal: true, address: 'Thames 1650' }),
  t('s-2', 'bartender', 'Bar Mirasol', -34.5878, -58.4228, { pay_amount: '72000.00', pay_band: 'por_encima', start_at: iso('21:00'), end_at: iso('03:00', 1) }),
  t('s-3', 'cocinero', 'Cantina Gorriti', -34.5925, -58.4290, { pay_amount: '68000.00', start_at: iso('19:30'), end_at: iso('01:30', 1) }),
  t('s-4', 'runner', 'Café Thames', -34.5935, -58.4210, { pay_amount: '60000.00', start_at: iso('20:30'), end_at: iso('02:00', 1) }),
  t('s-5', 'barista', 'Tostadero Serrano', -34.5868, -58.4262, { pay_amount: '61000.00', start_at: iso('08:00', 1), end_at: iso('14:00', 1) }),
];
const PERFIL = { ...real('perfil_trabajador'), full_name: 'Sofía Ramírez', city: 'Palermo, CABA', latitude: CASA.lat, longitude: CASA.lng,
  rating: 4.9, events_completed: 38, punctuality_rate: 0.97, years_experience: 4, identidad_verificada: true, level: 'oro', badges: ['nunca_falto'],
  skills: ['mozo', 'runner', 'personal_salon'], bio: 'Salón, runner y barra. Llego antes y dejo todo en orden.', is_available: true };

async function trabajador(theme, ahora = iso('19:00'), extra = {}) {
  const { b, ctx, p } = await abrir({ theme, rol: 'worker', ahora, reloj: !!extra.reloj, me: { full_name: 'Sofía Ramírez' } });
  await ctx.grantPermissions(['geolocation'], { origin: APP_URL });
  await ctx.setGeolocation({ latitude: CASA.lat, longitude: CASA.lng });
  await p.route('**/api/v1/workers/me/profile', (r) => r.fulfill(json(PERFIL)));
  await p.route('**/api/v1/shifts/feed**', (r) => r.fulfill(json(extra.feed || FEED)));
  await p.route('**/api/v1/workers/me/available-now', (r) => r.fulfill(json({ active: false, until: null })));
  await p.route('**/api/v1/identity/me', (r) => r.fulfill(json({ user_id: 'user-worker-1', assurance_level: 'basico', claims: [{ claim_type: 'documento_verificado', status: 'verificada', confidence: null, decided_at: null, rejection_reason: null }] })));
  await p.route('**/api/v1/workers/me/earnings**', (r) => r.fulfill(json({ total_earned: '2470000', this_month_earned: '520000', shifts_completed: 38 })));
  return { b, ctx, p };
}
const sufijo = (th) => (th === 'dark' ? '-noche' : '');

async function inicio(th) {
  const { b, p } = await trabajador(th);
  await p.goto(APP_URL + '/feed'); await listo(p);
  await foto(p, `t-inicio${sufijo(th)}`, { espera: 1500 });
  await foto(p, `t-inicio-full${sufijo(th)}`, { full: true });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function buscar(th) {
  const { b, p } = await trabajador(th);
  let postulado = false;
  await p.route('**/api/v1/applications/shifts/*', (r) => { postulado = true; return r.fulfill(json(deContrato('postular', {}), 201)); });
  await p.route('**/api/v1/applications/mine', (r) => r.fulfill(json(postulado ? deContrato('postulaciones_mias', [{ shift_id: 'shift-1', shift: FEED[0], id: 'application-1' }]) : [])));
  await p.goto(APP_URL + '/buscar'); await listo(p);
  await foto(p, `t-buscar${sufijo(th)}`, { espera: 1500 });
  await foto(p, `t-buscar-full${sufijo(th)}`, { full: true });
  const boton = p.getByRole('button', { name: /Postularme/ }).first();
  console.log('postularme', await boton.boundingBox());
  await boton.click();
  await foto(p, `t-postulado${sufijo(th)}`, { espera: 1200 });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function secuencia(p, nombre, ms, cada = 0) {
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < ms) {
    const dt = Date.now() - t0;
    await p.screenshot({ path: require('path').join(require('./lib').OUT, `${nombre}-${String(i).padStart(3, '0')}-${String(dt).padStart(5, '0')}.png`) });
    i++; if (cada) await p.waitForTimeout(cada);
  }
  console.log('  ', nombre, i, 'cuadros');
}

async function mapa(th) {
  const { b, p } = await trabajador(th, iso('19:00'), { reloj: true });
  const S = sufijo(th);
  await p.goto(APP_URL + '/map'); await listo(p);
  await p.waitForTimeout(5000);
  await foto(p, `t-mapa${S}`, { espera: 300 });
  const ahora = await p.evaluate(() => Date.now());
  let pin = null;
  for (const l of await p.locator('[aria-label^="Turno de "]').all()) {
    const bb = await l.boundingBox(); const n = await l.getAttribute('aria-label');
    console.log('pin', n, bb && Math.round(bb.x), bb && Math.round(bb.y));
    if (bb && bb.y > 230 && bb.y < 380 && !pin && !n.includes('65.000')) pin = { l, bb, n };
  }
  if (pin) {
    console.log('toco', pin.n, JSON.stringify(pin.bb));
    await cuadroACuadro(p, `t-mapa-toque${S}`, { n: 36, ahoraMs: ahora + 200, antes: async () => { await pin.l.evaluate((el) => el.click()); } });
    await p.clock.resume();
    await foto(p, `t-mapa-pin${S}`, { espera: 800 });
  }
  const manija = p.locator('[aria-label^="Arrastrá o tocá"]').first();
  const bb = await manija.boundingBox();
  if (bb) {
    const x = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2;
    const dir = require('path').join(OUT, 'rec', `t-mapa-hoja${S}`); require('fs').mkdirSync(dir, { recursive: true });
    await p.clock.pauseAt(new Date((await p.evaluate(() => Date.now())) + 200));
    await p.mouse.move(x, y0); await p.mouse.down();
    let i = 0; const shot = async () => { await p.screenshot({ path: require('path').join(dir, `${String(i++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 }); };
    const pasos = 14;
    for (let k = 1; k <= pasos; k++) { const e = 1 - Math.pow(1 - k / pasos, 2); await p.mouse.move(x, y0 - (y0 - 150) * e); await p.clock.runFor(33); await shot(); }
    await p.mouse.up();
    for (let k = 0; k < 24; k++) { await p.clock.runFor(33); await shot(); }
    require('fs').writeFileSync(require('path').join(dir, 'cuadros.json'), JSON.stringify(Array.from({ length: i }, (_, j) => ({ f: `${String(j).padStart(4, '0')}.jpg`, t: j / 30 }))));
    console.log('  hoja', i);
    await p.clock.resume();
    await foto(p, `t-mapa-hoja-arriba${S}`, { espera: 600 });
  }
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

const mio = (o) => deContrato('turnos_asignados_trabajador', [{ ...FEED[0], worker_profile_id: 'worker-profile-1', first_assigned_at: iso('19:07'), ...o }])[0];

async function misTurnos(th, nombre, turno, ahora, accion) {
  const { b, ctx, p } = await trabajador(th, ahora);
  let actual = turno;
  await p.route('**/api/v1/shifts/mine**', (r) => r.fulfill(json([actual])));
  await p.route('**/api/v1/shifts/*/confirm', (r) => { actual = { ...actual, status: 'confirmado', confirmed_at: iso('19:08') }; return r.fulfill(json(actual)); });
  await p.route('**/api/v1/shifts/*/en-route', (r) => { actual = { ...actual, en_route_at: iso('19:30'), en_route_latitude: CASA.lat, en_route_longitude: CASA.lng }; return r.fulfill(json(actual)); });
  await p.route('**/api/v1/shifts/*/depart', (r) => r.fulfill(json(actual)));
  await p.route('**/api/v1/reviews/shifts/*', (r) => r.request().method() === 'GET' ? r.fulfill(json([])) : r.fulfill(json({ id: 'r9', shift_id: actual.id, reviewer_user_id: 'user-worker-1', reviewee_user_id: 'c1', rating: 5, comment: null, created_at: iso('04:10', 1) }, 201)));
  await p.goto(APP_URL + '/my-shifts'); await listo(p);
  await foto(p, nombre, { espera: 1500 });
  await foto(p, nombre + '-full', { full: true });
  if (accion) await accion(p, nombre);
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function perfil(th) {
  const { b, p } = await trabajador(th);
  await p.route('**/api/v1/reviews/received**', (r) => r.fulfill(json([
    { id: 'r1', shift_id: 's1', reviewer_user_id: 'c1', reviewee_user_id: 'user-worker-1', rating: 5, comment: 'Llegó antes de hora y se puso el salón al hombro.', created_at: iso('03:00', -6) },
    { id: 'r2', shift_id: 's2', reviewer_user_id: 'c2', reviewee_user_id: 'user-worker-1', rating: 5, comment: 'Rápida y prolija. La volvemos a llamar.', created_at: iso('03:00', -13) },
  ])));
  await p.goto(APP_URL + '/profile'); await listo(p);
  await foto(p, `t-perfil${sufijo(th)}`, { espera: 1500 });
  await foto(p, `t-perfil-full${sufijo(th)}`, { full: true });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function aviso(th) {
  const { b, p } = await trabajador(th, iso('19:07'));
  await p.route('**/api/v1/notifications**', (r) => r.fulfill(json([{ ...real('avisos_trabajador')[0], id: 'n1', type: 'shift_assigned', title: 'Te asignaron un turno', message: 'Te asignaron el turno "Mozo/a". Confirmá tu asistencia.', link: '/my-shifts', read: false, created_at: iso('19:07') }])));
  await p.goto(APP_URL + '/feed'); await listo(p);
  await foto(p, `t-aviso-campana${sufijo(th)}`, { espera: 1500 });
  await p.getByRole('button', { name: 'Notificaciones' }).first().click();
  await foto(p, `t-aviso${sufijo(th)}`, { espera: 900 });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

(async () => {
  const que = process.argv[2] || 'todo';
  const th = process.argv[3] || 'light';
  if (que === 'inicio' || que === 'todo') await inicio(th);
  if (que === 'buscar' || que === 'todo') await buscar(th);
  if (que === 'mapa' || que === 'todo') await mapa(th);
  if (que === 'turnos' || que === 'todo') {
    await misTurnos(th, `t-elegida${sufijo(th)}`, mio({ status: 'asignado' }), iso('19:07'), async (p, n) => {
      const b = p.getByRole('button', { name: /Confirmar/ }).first();
      console.log('confirmar', await b.boundingBox().catch(() => null));
      if (await b.count()) { await b.click(); await foto(p, `t-confirmado${sufijo(th)}`, { espera: 1500 }); }
    });
    await misTurnos(th, `t-antes${sufijo(th)}`, mio({ status: 'confirmado', confirmed_at: iso('19:08') }), iso('19:28'), async (p) => {
      const b = p.getByRole('button', { name: 'Voy en camino' }).first();
      console.log('voy', await b.boundingBox().catch(() => null));
      if (await b.count()) { await b.click(); await foto(p, `t-en-camino${sufijo(th)}`, { espera: 1500 }); }
    });
    await misTurnos(th, `t-terminado${sufijo(th)}`, mio({ status: 'finalizado', confirmed_at: iso('19:08'), check_in_at: iso('19:53'), check_out_at: iso('04:02', 1) }), iso('04:10', 1), async (p) => {
      const estrellas = p.locator('.caja-resena button');
      for (let k = 0; k < 5; k++) console.log('estrella', k, JSON.stringify(await estrellas.nth(k).boundingBox()));
      for (let k = 0; k < 5; k++) { await estrellas.nth(k).click(); await foto(p, `t-califica-${k + 1}${sufijo(th)}`, { espera: 150 }); }
      await p.locator('.caja-resena textarea').fill('Muy buen equipo, todo claro desde que llegué.');
      await foto(p, `t-califica-texto${sufijo(th)}`, { espera: 200 });
      console.log('enviar', JSON.stringify(await p.getByRole('button', { name: 'Enviar calificación' }).boundingBox()));
      await p.getByRole('button', { name: 'Enviar calificación' }).click();
      await foto(p, `t-calificado${sufijo(th)}`, { espera: 1200 });
    });
  }
  if (que === 'perfil' || que === 'todo') await perfil(th);
  if (que === 'aviso' || que === 'todo') await aviso(th);
})();
