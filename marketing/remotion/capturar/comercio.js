// Capturas del lado del comercio: publicar con el asistente, candidatos, ¡Oído!, va en camino.
const { abrir, foto, listo, json, deContrato, real, iso, APP_URL } = require('./lib');

const LOCAL = { lat: -34.5852, lng: -58.4301 }; // Thames y Gorriti, Palermo (ejemplo)
const PERFIL_LOCAL = {
  ...real('perfil_comercio'), name: 'Bar Lavalle', address: 'Thames 1650, Palermo', city: 'Palermo, CABA',
  latitude: LOCAL.lat, longitude: LOCAL.lng, rating: 4.8, events_published: 26, on_time_payment_rate: 1, payments_recorded: 24,
  owner_full_name: 'Martín Lavalle', cover_photo_url: '/landing/bar2.webp',
};
const TURNO = (o = {}) => deContrato('turno_publicado_comercio', {
  id: 'shift-1', position: 'mozo', company_name: 'Bar Lavalle', address: 'Thames 1650', city: 'Palermo',
  latitude: LOCAL.lat, longitude: LOCAL.lng, start_at: iso('20:00'), end_at: iso('04:00', 1), pay_amount: '65000.00',
  urgent: true, tips: false, meal: true, ...o,
});
const persona = (id, nombre, extra = {}) => ({
  application_id: `app-${id}`, worker_profile_id: `wp-${id}`, full_name: nombre, photo_url: null, rating: 4.6, is_available: true,
  status: 'pendiente', motivo: null, created_at: iso('19:03'), events_completed: 8, punctuality_rate: 0.92, years_experience: 2,
  badges: [], level: 'bronce', identidad_verificada: false, ...extra,
});
const POSTULANTES = [
  persona('1', 'Sofía Ramírez', { rating: 4.9, events_completed: 38, punctuality_rate: 0.97, years_experience: 4, identidad_verificada: true, level: 'oro', badges: ['nunca_falto'], created_at: iso('19:02') }),
  persona('2', 'Lucas Medina', { rating: 4.7, events_completed: 15, punctuality_rate: 0.93, years_experience: 2, created_at: iso('19:04') }),
  persona('3', 'Ana Paz', { rating: 4.5, events_completed: 6, punctuality_rate: 0.9, years_experience: 1, created_at: iso('19:05') }),
];
const cand = (id, nombre, extra) => ({ profile_id: `wp-${id}`, user_id: `u-${id}`, full_name: nombre, photo_url: null, rating: 4.6, score: 0.8, distance_km: 1.2, events_completed: 8, punctuality_rate: 0.9, years_experience: 2, badges: [], level: 'bronce', identidad_verificada: false, ...extra });
const RECOMENDADOS = [
  cand('1', 'Sofía Ramírez', { rating: 4.9, score: 0.94, distance_km: 0.7, events_completed: 38, punctuality_rate: 0.97, years_experience: 4, identidad_verificada: true, level: 'oro', badges: ['nunca_falto'] }),
  cand('4', 'Diego Sosa', { rating: 4.8, score: 0.88, distance_km: 0.9, events_completed: 22, punctuality_rate: 0.95, years_experience: 3, identidad_verificada: true }),
  cand('2', 'Lucas Medina', { rating: 4.7, score: 0.81, distance_km: 2.4, events_completed: 15, punctuality_rate: 0.93 }),
];

async function comercio(theme = 'light', ahora = iso('19:01')) {
  const { b, p } = await abrir({ theme, rol: 'employer', ahora, me: { full_name: 'Martín Lavalle' } });
  await p.route('**/api/v1/companies/me/profile', (r) => r.fulfill(json(PERFIL_LOCAL)));
  await p.route('**/api/v1/subscription**', (r) => r.fulfill(json(real('suscripcion_comercio'))));
  return { b, p };
}

async function rutasPublicar(p) {
  await p.route('**/api/v1/shifts/parse-text', (r) => r.fulfill(json({
    position: 'mozo', start_at: iso('20:00'), end_at: iso('04:00', 1), pay_amount: '65000', urgent: true, meal: true, tips: false, dress_code: null,
  })));
  await p.route('**/api/v1/shifts', (r) => r.request().method() === 'POST' ? r.fulfill(json(TURNO({ status: 'borrador' }), 201)) : r.fulfill(json([])));
  await p.route('**/api/v1/shifts/shift-1', (r) => r.fulfill(json(TURNO({ status: 'borrador' }))));
  await p.route('**/api/v1/shifts/shift-1/publish', (r) => r.fulfill(json(TURNO())));
}
async function publicar(theme) {
  const { b, p } = await comercio(theme);
  await rutasPublicar(p);
  await p.goto(APP_URL + '/shifts/new');
  await listo(p);
  const t = theme === 'dark' ? '-noche' : '';
  await foto(p, `c-publicar-0${t}`, { espera: 900 });
  const campo = p.getByPlaceholder('Ej: necesito un mozo el sábado a la noche, se paga 45000');
  const texto = 'Necesito un mozo hoy de 20 a 4, pago 65 mil';
  await campo.click();
  const cortes = [0, 4, 10, 19, 27, 35, 41, texto.length];
  for (let i = 1; i < cortes.length; i++) {
    await campo.fill(texto.slice(0, cortes[i]));
    await foto(p, `c-publicar-tipeo-${i}${t}`, { espera: 120 });
  }
  await p.getByRole('button', { name: 'Completar' }).click();
  await p.getByRole('heading', { name: '¿Dónde es?' }).waitFor();
  await foto(p, `c-publicar-donde${t}`, { espera: 900 });
  await foto(p, `c-publicar-donde-full${t}`, { full: true });
  const pub = p.getByRole('button', { name: /Publicar/ }).last();
  await pub.scrollIntoViewIfNeeded();
  await foto(p, `c-publicar-boton${t}`, { espera: 400 });
  console.log('boton publicar', await pub.boundingBox());
  await pub.click();
  await foto(p, `c-publicado${t}`, { espera: 1500 });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function rutasCandidatos(p) {
  await p.route('**/api/v1/shifts/shift-1', (r) => r.fulfill(json(TURNO({ pending_applicants_count: 3 }))));
  await p.route('**/api/v1/applications/shifts/shift-1', (r) => r.fulfill(json(POSTULANTES)));
  await p.route('**/api/v1/shifts/shift-1/candidates', (r) => r.fulfill(json(RECOMENDADOS)));
  await p.route('**/api/v1/shifts/shift-1/assign', (r) => r.fulfill(json(TURNO({ status: 'asignado', worker_profile_id: 'wp-1', worker_name: 'Sofía Ramírez' }))));
}
async function candidatos(theme) {
  const { b, p } = await comercio(theme, iso('19:06'));
  await rutasCandidatos(p);
  const t = theme === 'dark' ? '-noche' : '';
  await p.goto(APP_URL + '/shifts/shift-1/candidates');
  await listo(p);
  await foto(p, `c-candidatos${t}`, { espera: 900 });
  await foto(p, `c-candidatos-full${t}`, { full: true });
  await p.getByRole('button', { name: /Recomendados/ }).click();
  await foto(p, `c-recomendados${t}`, { espera: 900 });
  await foto(p, `c-recomendados-full${t}`, { full: true });
  const elegir = p.getByRole('button', { name: 'Elegir a Sofía', exact: true });
  console.log('boton elegir', await elegir.boundingBox());
  // ¡Oído! cuadro a cuadro: las animaciones CSS a 1/10 de velocidad.
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
  await elegir.click();
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    const ms = Date.now() - t0;
    await foto(p, `c-oido-anim-${String(i).padStart(2, '0')}-${Math.round(ms / 10)}${t}`, { espera: 0 });
    if (ms > 16000) break;
  }
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await foto(p, `c-oido${t}`, { espera: 2500 });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

// Panel con «va en camino»: la última posición que mandó, sin recorrido.
async function enCamino(theme, pos, nombre, extra = {}, ahora = iso('19:31')) {
  const { b, p } = await comercio(theme, ahora);
  const turno = TURNO({ status: 'confirmado', worker_profile_id: 'wp-1', worker_name: 'Sofía Ramírez', confirmed_at: iso('19:08'), first_assigned_at: iso('19:07'),
    en_route_at: pos ? iso(pos.hora) : null, en_route_latitude: pos ? pos.lat : null, en_route_longitude: pos ? pos.lng : null, ...extra });
  await p.route('**/api/v1/shifts/me**', (r) => r.fulfill(json([turno])));
  await p.route('**/api/v1/shifts/mine**', (r) => r.fulfill(json([turno])));
  await p.goto(APP_URL + '/shifts');
  await listo(p);
  await p.waitForTimeout(2500);
  await foto(p, nombre, { espera: 600 });
  if (!pos) await foto(p, nombre + '-full', { full: true });
  await p.evaluate(() => { const m = document.querySelector('.maplibregl-map') || document.querySelector('[data-shift-id]'); if (m) m.scrollIntoView({ block: 'center' }); });
  await foto(p, nombre + '-abajo', { espera: 1200 });
  const mapa = p.locator('.maplibregl-map').first();
  if (await mapa.count()) console.log(nombre, 'mapa', await mapa.boundingBox());
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

async function ficha(theme) {
  const { b, p } = await comercio(theme, iso('19:06'));
  const perfil = { ...real('perfil_trabajador'), id: 'wp-1', full_name: 'Sofía Ramírez', city: 'Palermo, CABA', rating: 4.9, events_completed: 38,
    punctuality_rate: 0.97, years_experience: 4, identidad_verificada: true, level: 'oro', badges: ['nunca_falto'], skills: ['mozo', 'runner', 'personal_salon'],
    bio: 'Salón, runner y barra. Llego antes y dejo todo en orden.', latitude: -34.5900, longitude: -58.4245 };
  await p.route('**/api/v1/workers/wp-1**', (r) => r.fulfill(json(perfil)));
  await p.route('**/api/v1/reviews/**', (r) => r.fulfill(json([
    { id: 'r1', shift_id: 's1', reviewer_user_id: 'c1', reviewee_user_id: 'u-1', rating: 5, comment: 'Llegó antes de hora y se puso el salón al hombro.', created_at: iso('03:00', -6) },
    { id: 'r2', shift_id: 's2', reviewer_user_id: 'c2', reviewee_user_id: 'u-1', rating: 5, comment: 'Rápida y prolija. La volvemos a llamar.', created_at: iso('03:00', -13) },
  ])));
  const t = theme === 'dark' ? '-noche' : '';
  await p.goto(APP_URL + '/workers/wp-1');
  await listo(p);
  await foto(p, `c-ficha${t}`, { espera: 1200 });
  await foto(p, `c-ficha-full${t}`, { full: true });
  console.log('sin manejar:', [...p.sinManejar].join(' | '));
  await b.close();
}

module.exports = { comercio, rutasPublicar, rutasCandidatos };
if (require.main === module) (async () => {
  const que = process.argv[2] || 'todo';
  if (que === 'publicar' || que === 'todo') await publicar('light');
  if (que === 'candidatos' || que === 'todo') await candidatos('light');
  if (que === 'ficha' || que === 'todo') { await ficha('light'); }
  if (que === 'camino' || que === 'todo') {
    // Las posiciones que va mandando (cada una reemplaza a la anterior).
    const pasos = [
      { lat: -34.6005, lng: -58.4110, hora: '19:30' },
      { lat: -34.5960, lng: -58.4185, hora: '19:37' },
      { lat: -34.5905, lng: -58.4250, hora: '19:44' },
      { lat: -34.5868, lng: -58.4288, hora: '19:50' },
    ];
    const ahoras = ['19:31', '19:38', '19:45', '19:51'];
    for (const th of ['dark', 'light']) {
      for (let i = 0; i < pasos.length; i++) await enCamino(th, pasos[i], `c-camino-${i}${th === 'dark' ? '-noche' : ''}`, {}, iso(ahoras[i]));
      await enCamino(th, null, `c-llego${th === 'dark' ? '-noche' : ''}`, { status: 'check_in', check_in_at: iso('19:53'), check_in_latitude: LOCAL.lat, check_in_longitude: LOCAL.lng }, iso('19:54'));
    }
  }
})();
