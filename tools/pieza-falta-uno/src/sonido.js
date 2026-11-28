// Banda de sonido sintetizada, calculada sin tiempo real (OfflineAudioContext), alineada al cuadro con la misma línea de tiempo que la imagen.
// Nada grabado ni de catálogo: ruido filtrado, senos con envolventes, reverberación por convolución con salas generadas.
import { rng, clamp, lerp, smooth } from './util.js';

function caja(dur, sr, semilla) {
  const ac = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(dur * sr), sampleRate: sr });
  const R = rng(semilla);

  // ---------- utilidades ----------
  const buf = (seg, f) => { const n = Math.max(1, Math.round(seg * sr)), b = ac.createBuffer(2, n, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); f(d, c, n); } return b; };
  const ruido = (seg, tipo = 'blanco', semilla = 1) => buf(seg, (d, c, n) => {
    const r = rng(semilla * 7 + c * 1013); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (tipo === 'blanco') d[i] = w;
      else if (tipo === 'rosa') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
      else { br = (br + .02 * w) / 1.02; d[i] = br * 3.5; }
    }
  });
  const sala = (seg, decae, semilla, brillo = .7, pre = .01) => buf(seg, (d, c, n) => {
    const r = rng(semilla + c * 31); let lp = 0; const p0 = Math.round(pre * sr);
    for (let i = 0; i < n; i++) { const t = i / sr, a = Math.exp(-t * 6.9 / decae); const k = clamp(brillo - t / decae * .55, .04, .98); lp += (r() * 2 - 1 - lp) * k; d[i] = i < p0 ? 0 : lp * a * (i - p0 < 200 ? (i - p0) / 200 : 1); }
  });
  const nodo = {
    gan: (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; },
    filtro: (type, f, Q = .7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; },
    pan: v => { const p = ac.createStereoPanner(); p.pan.value = v; return p; },
  };
  const cadena = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[0]; };
  // envolvente por puntos [t, v] sobre un AudioParam (rampas lineales)
  const env = (param, pts, base = 0) => { param.setValueAtTime(pts.length ? pts[0][1] : base, Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); };
  const envExp = (param, pts) => { param.setValueAtTime(Math.max(1e-4, pts[0][1]), Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.exponentialRampToValueAtTime(Math.max(1e-4, pts[i][1]), Math.max(0, pts[i][0])); };
  const tocar = (b, t0, dest, { rate = 1, desde = 0, dura } = {}) => { const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.connect(dest); s.start(Math.max(0, t0), desde, dura); return s; };
  const osc = (tipo, f, t0, t1, dest, det = 0) => { const o = ac.createOscillator(); o.type = tipo; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(Math.max(0, t0)); o.stop(t1); return o; };

  // ---------- mezcla: tres buses, dos salas, compresor y limitador suave ----------
  const master = nodo.gan(1);
  const comp = ac.createDynamicsCompressor(); Object.assign(comp, {}); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.2; comp.attack.value = .004; comp.release.value = .2;
  const lim = ac.createWaveShaper(); { const c = new Float32Array(4097); for (let i = 0; i < 4097; i++) { const x = i / 2048 - 1; c[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); } lim.curve = c; lim.oversample = '4x'; }
  const salida = nodo.gan(0.84);
  cadena(master, comp, lim, salida); salida.connect(ac.destination);
  const conv = (b, g) => { const c = ac.createConvolver(); c.normalize = true; c.buffer = b; const o = nodo.gan(g); cadena(c, o, master); return c; };
  const salaCocina = conv(sala(0.9, 0.7, 11, .75, .006), 0.9);
  const salaAbierta = conv(sala(4.2, 3.6, 23, .55, .03), 1.0);
  const envios = (dest, cocina, abierta) => { const n = nodo.gan(1); n.connect(dest); if (cocina) { const g = nodo.gan(cocina); n.connect(g); g.connect(salaCocina); } if (abierta) { const g = nodo.gan(abierta); n.connect(g); g.connect(salaAbierta); } return n; };

  return { ac, R, buf, ruido, sala, nodo, cadena, env, envExp, tocar, osc, master, envios, salaCocina, salaAbierta };
}

export async function bandaEscena3({ GOLPES, crece, camY, TECHO }, { dur = 10, sr = 48000 } = {}) {
  const { ac, R, buf, ruido, sala, nodo, cadena, env, envExp, tocar, osc, master, envios } = caja(dur, sr, 4242);
  const T_TECHO = 8.17, T_AFUERA = 8.24;

  // ---------- 1. el salón y la cocina (adentro) ----------
  {
    const adentro = nodo.gan(1); const tapa = nodo.filtro('lowpass', 18000, .5), corte = nodo.filtro('highpass', 90, .7);
    cadena(adentro, corte, tapa, master);
    env(adentro.gain, [[0, 1], [7.4, 1], [T_TECHO, 0.5], [T_AFUERA + 0.05, 0]]);
    envExp(tapa.frequency, [[0, 18000], [7.6, 9000], [T_TECHO, 700], [T_AFUERA + 0.1, 200]]);
    const ensal = envios(adentro, 0.25, 0);
    // murmullo: tres bandas de voces con sílabas al azar
    const mur = ruido(dur + 1, 'rosa', 3);
    for (const [f, q, g] of [[320, 1.1, .05], [850, 1.4, .045], [2300, 2.2, .018]]) {
      const bp = nodo.filtro('bandpass', f, q), a = nodo.gan(0), p = nodo.pan((R() - .5) * .6);
      cadena(bp, a, p, ensal); tocar(mur, 0, bp, { desde: R() * .5 });
      // sílabas: amplitud que sube y baja a 3–6 Hz
      let t = 0; a.gain.setValueAtTime(g * .6, 0);
      while (t < 8.4) { const v = g * (.35 + R() * .9) * lerp(1, 0.55, smooth(1, 6, t)); t += .12 + R() * .2; a.gain.linearRampToValueAtTime(v, t); }
    }
    // la campana de la cocina: zumbido de 50 Hz
    const hum = nodo.gan(.007), lp = nodo.filtro('lowpass', 260, .8); cadena(lp, hum, adentro);
    osc('sawtooth', 50, 0, 9, lp); osc('sawtooth', 100.3, 0, 9, lp);
    // ruidos de cocina lejos: ollas, cubiertos
    for (let i = 0; i < 9; i++) {
      const t = 0.3 + R() * 7.2, f = 1400 + R() * 3000, g = nodo.gan(0), p = nodo.pan((R() - .5) * 1.4); cadena(g, p, envios(adentro, 1.6, 0));
      env(g.gain, [[t, 0], [t + .002, .02 + R() * .025], [t + .25, 0]]);
      for (const k of [1, 2.71, 5.2]) osc('sine', f * k, t, t + .3, g);
    }
  }

  // ---------- 2. los golpes: papel contra el pinche, cada uno más agudo ----------
  const papel = ruido(0.4, 'blanco', 77);
  GOLPES.forEach((T, k) => {
    const fuerte = k < 5 ? 1 : lerp(.8, .45, (k - 5) / 8), P = Math.pow(2, Math.min(k, 13) * 1.6 / 12);
    const bus = envios(master, k < 5 ? .38 : .25, 0), pan = nodo.pan(0.14); pan.connect(bus);
    // la mano que llega (aire)
    if (k < 9) { const bp = nodo.filtro('bandpass', 900, 1.2), g = nodo.gan(0); cadena(bp, g, pan); tocar(ruido(.3, 'rosa', 300 + k), T - .2, bp); envExp(bp.frequency, [[T - .2, 700], [T, 3200]]); env(g.gain, [[T - .2, 0], [T - .03, .09 * fuerte], [T, 0]]); }
    // el chasquido del papel
    { const bp = nodo.filtro('bandpass', 1900 * P, .9), hp = nodo.filtro('highpass', 380, .7), g = nodo.gan(0); cadena(bp, hp, g, pan); tocar(papel, T, bp, { desde: R() * .2, rate: .9 + R() * .2 }); envExp(g.gain, [[T, .001], [T + .0015, .95 * fuerte], [T + .09, .002]]); }
    // el crujido que queda
    for (let j = 0; j < 7; j++) { const t = T + .015 + R() * .13, bp = nodo.filtro('bandpass', (2800 + R() * 2500) * P, 2.2), g = nodo.gan(0); cadena(bp, g, pan); tocar(papel, t, bp, { desde: R() * .3, dura: .02 }); env(g.gain, [[t, 0], [t + .002, .22 * fuerte * (1 - j / 9)], [t + .012, 0]]); }
    // la aguja: un «tic» metálico inarmónico
    { const g = nodo.gan(1); g.connect(pan); [[1, 1, .06], [2.76, .5, .035], [5.4, .3, .02], [8.93, .15, .012]].forEach(([m, a, d]) => { const gg = nodo.gan(0); gg.connect(g); envExp(gg.gain, [[T, .0001], [T + .0008, .16 * a * fuerte], [T + d * 1.4, .0001]]); osc('sine', 2350 * P * m, T, T + d * 1.6, gg); }); }
    // el golpe en el mostrador de acero: cuerpo grave y resonancia
    { const g = nodo.gan(0), o = ac.createOscillator(); o.type = 'sine'; envExp(o.frequency, [[T, 130 * Math.sqrt(P)], [T + .07, 52]]); o.connect(g); g.connect(pan); o.start(T); o.stop(T + .4); envExp(g.gain, [[T, .0001], [T + .002, .85 * fuerte], [T + .22, .0001]]); }
    { const g = nodo.gan(1); g.connect(pan); [[420, .45], [1130, .3], [2210, .16]].forEach(([f, d]) => { const gg = nodo.gan(0); gg.connect(g); envExp(gg.gain, [[T, .0001], [T + .002, .045 * fuerte], [T + d, .0001]]); osc('sine', f * Math.pow(P, .3), T, T + d + .05, gg); }); }
    // un pulso sub, para el peso
    if (k < 5) { const g = nodo.gan(0); g.connect(master); envExp(g.gain, [[T, .0001], [T + .004, .5], [T + .45, .0001]]); osc('sine', 44, T, T + .5, g); }
  });

  // ---------- 3. la música: un bordón que se tensa ----------
  {
    const g = nodo.gan(0), lp = nodo.filtro('lowpass', 380, .9); cadena(lp, g, envios(master, .15, .35));
    env(g.gain, [[0.8, 0], [5.5, .03], [8.2, .045], [9.2, .02], [10, .012]]); envExp(lp.frequency, [[0.8, 300], [5.5, 500], [8.17, 1700], [9, 700]]);
    for (const [f, d] of [[73.42, -6], [73.42, 7], [110, -4], [110, 5], [146.83, 0]]) osc('sawtooth', f, .8, dur, lp, d);
    // cuerdas agudas en trémolo desde el último «otra»
    const gt = nodo.gan(0), bp = nodo.filtro('bandpass', 1500, .8), trem = nodo.gan(.5); cadena(bp, trem, gt, envios(master, .2, .5));
    env(gt.gain, [[5.7, 0], [7.4, .02], [8.17, .05], [8.4, .0]]);
    const lfo = ac.createOscillator(); lfo.frequency.value = 9; const lg = nodo.gan(.5); lfo.connect(lg); lg.connect(trem.gain); lfo.start(5.6); lfo.stop(9);
    for (const [f, d] of [[587.33, -5], [659.25, 6], [880, -3], [1174.66, 4]]) osc('sawtooth', f, 5.6, 9, bp, d);
  }

  // ---------- 4. la avalancha: papeles cada vez más seguidos y una subida ----------
  {
    const bus = envios(master, .3, .1);
    let t = 7.62; let n = 0;
    while (t < 8.3) {
      const u = clamp((t - 7.62) / .6), rate = 18 * Math.pow(25, u), P = Math.pow(2, (1.6 + u * 1.2));
      const bp = nodo.filtro('bandpass', (1600 + R() * 3400) * P * .5, 1.6), g = nodo.gan(0), p = nodo.pan((R() - .5) * (.3 + u * .9)); cadena(bp, g, p, bus);
      tocar(papel, t, bp, { desde: R() * .3, dura: .03, rate: .8 + R() * .5 }); env(g.gain, [[t, 0], [t + .002, (.28 - u * .14) * (0.6 + R() * .4)], [t + .02, 0]]);
      t += (1 / rate) * (.5 + R()); n++;
    }
    // subida: ruido que barre y tonos que trepan
    const sb = nodo.filtro('bandpass', 400, 1.1), sg = nodo.gan(0); cadena(sb, sg, envios(master, .1, .4)); tocar(ruido(1.6, 'rosa', 91), 7.1, sb);
    envExp(sb.frequency, [[7.1, 300], [8.17, 6500], [8.6, 3000]]); env(sg.gain, [[7.1, 0], [8.1, .2], [8.24, .12], [8.7, 0]]);
    const tg = nodo.gan(0); tg.connect(envios(master, 0, .6)); env(tg.gain, [[7.0, 0], [8.1, .05], [8.3, 0]]);
    for (let o = 0; o < 4; o++) { const os = ac.createOscillator(); os.type = 'sine'; envExp(os.frequency, [[7.0, 146.83 * Math.pow(2, o)], [8.2, 146.83 * Math.pow(2, o + 1)]]); const og = nodo.gan([.4, .8, .6, .25][o]); os.connect(og); og.connect(tg); os.start(7); os.stop(8.4); }
  }

  // ---------- 5. el techo: zumbido de paso y un crujido sordo ----------
  {
    const bp = nodo.filtro('bandpass', 4000, 1), g = nodo.gan(0); cadena(bp, g, envios(master, 0, .5)); tocar(ruido(.6, 'blanco', 5), T_TECHO - .12, bp);
    envExp(bp.frequency, [[T_TECHO - .12, 5000], [T_TECHO + .35, 260]]); env(g.gain, [[T_TECHO - .12, 0], [T_TECHO, .5], [T_TECHO + .35, 0]]);
    const bg = nodo.gan(0); bg.connect(master); envExp(bg.gain, [[T_TECHO, .0001], [T_TECHO + .01, .55], [T_TECHO + .5, .0001]]); osc('sine', 48, T_TECHO, T_TECHO + .6, bg);
    const lp = nodo.filtro('lowpass', 900, .7), cg = nodo.gan(0); cadena(lp, cg, envios(master, .5, .2)); tocar(ruido(.5, 'marron', 8), T_TECHO + .005, lp); envExp(cg.gain, [[T_TECHO, .0001], [T_TECHO + .01, .5], [T_TECHO + .4, .0001]]);
  }

  // ---------- 6. afuera: viento, la ciudad, el papel que aletea, el acorde que no resuelve ----------
  {
    const afuera = nodo.gan(0); afuera.connect(master); env(afuera.gain, [[T_AFUERA - .05, 0], [T_AFUERA + .15, 1], [dur, 1]]);
    // viento: más fuerte mientras la cámara vuela
    const vb = nodo.filtro('bandpass', 700, .45), vg = nodo.gan(0), vs = nodo.filtro('highpass', 150, .7); cadena(vs, vb, vg, afuera); tocar(ruido(dur, 'rosa', 51), 0, vs);
    const vel = t => { const h = .02; return Math.abs(camY(t + h) - camY(t - h)) / (2 * h); };
    vg.gain.setValueAtTime(0, 0); vb.frequency.setValueAtTime(500, 0);
    for (let t = T_AFUERA; t <= dur; t += .05) { const v = vel(t); vg.gain.linearRampToValueAtTime(clamp(.05 + v * .012, 0, .35) * (1 + .25 * Math.sin(t * 2.3)), t); vb.frequency.linearRampToValueAtTime(400 + v * 45, t); }
    // la ciudad lejos: un rumor grave y una bocina de colectivo
    const cl = nodo.filtro('lowpass', 220, .6), cg = nodo.gan(.07); cadena(cl, cg, afuera); tocar(ruido(dur, 'marron', 61), 0, cl);
    { const t = 9.15, lp = nodo.filtro('lowpass', 1400, .7), g = nodo.gan(0); cadena(lp, g, envios(afuera, 0, 1.8)); env(g.gain, [[t, 0], [t + .03, .012], [t + .55, .011], [t + .6, 0]]); osc('square', 392, t, t + .7, lp); osc('square', 494, t, t + .7, lp); }
    // el papel aleteando en la torre, de un lado al otro
    const al = nodo.filtro('bandpass', 1800, 1.3), am = nodo.gan(0), ag = nodo.gan(0), ap = nodo.pan(0); cadena(al, am, ag, ap, envios(afuera, 0, .35)); tocar(ruido(dur, 'blanco', 71), 0, al);
    const flap = ac.createOscillator(); flap.type = 'triangle'; flap.frequency.value = 13; const fg = nodo.gan(.5); flap.connect(fg); fg.connect(am.gain); am.gain.value = .5; flap.start(0); flap.stop(dur);
    env(ag.gain, [[T_AFUERA, 0], [8.6, .1], [9.6, .07], [dur, .06]]); env(ap.pan, [[T_AFUERA, -.4], [9, .5], [dur, -.2]]);
    // el acorde: re con segunda y cuarta, sin resolver
    const ac1 = nodo.gan(0), lp = nodo.filtro('lowpass', 900, .5); cadena(lp, ac1, envios(afuera, 0, 1.2)); env(ac1.gain, [[8.2, 0], [9.0, .022], [dur, .045]]); envExp(lp.frequency, [[8.2, 500], [dur, 2600]]);
    for (const [f, d] of [[146.83, -4], [220, 5], [293.66, -3], [329.63, 4], [392, -6], [440, 3]]) { osc('sawtooth', f, 8.2, dur, lp, d); osc('sawtooth', f, 8.2, dur, lp, d + 9); }
    const br = nodo.gan(0); br.connect(envios(afuera, 0, 1.5)); env(br.gain, [[8.6, 0], [dur, .018]]);
    for (const f of [1318.5, 1760]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const v = ac.createOscillator(); v.frequency.value = 5.2; const vgn = nodo.gan(f * .004); v.connect(vgn); vgn.connect(o.frequency); o.connect(br); o.start(8.6); o.stop(dur); v.start(8.6); v.stop(dur); }
  }

  return await ac.startRendering();
}

// ---------- la banda de la pieza entera (68 s) ----------
// La escena 3 se calcula aparte (bandaEscena3) y se monta a los 10 s; el resto se arma acá, escena por escena.
export async function bandaPieza({ GOLPES, crece, camY3, TECHO }, { dur = 68, sr = 48000 } = {}) {
  const b3 = await bandaEscena3({ GOLPES, crece, camY: camY3, TECHO }, { dur: 10.9, sr });
  const { ac, R, ruido, nodo, cadena, env, envExp, tocar, osc, master, envios } = caja(dur, sr, 777);
  const H = { pink: ruido(dur + 1, 'rosa', 11), blanco: ruido(3, 'blanco', 12), marron: ruido(dur + 1, 'marron', 13) };

  // ---------- piezas sonoras ----------
  const parciales = (t, f, lista, dest, g = 1, ataque = 0.002) => { const gg = nodo.gan(1); gg.connect(dest); for (const [m, a, d] of lista) { const x = nodo.gan(0); x.connect(gg); envExp(x.gain, [[t, 1e-4], [t + ataque, a * g], [t + d, 1e-4]]); osc('sine', f * m, t, t + d + 0.05, x); } };
  const campana = (t, g, dest) => { for (const det of [1, 1.0016]) parciales(t, 2093 * det, [[1, 0.5, 2.8], [2.41, 0.28, 1.6], [3.93, 0.16, 0.9], [5.43, 0.08, 0.5], [0.5, 0.06, 1.8]], dest, g * 0.5, 0.0015); const c = nodo.filtro('bandpass', 3800, 1.2), x = nodo.gan(0); cadena(c, x, dest); tocar(H.blanco, t, c, { desde: 0.3, dura: 0.02 }); envExp(x.gain, [[t, 1e-4], [t + 0.001, 0.4 * g], [t + 0.02, 1e-4]]); };
  const nota = (t, f, g, dest, d = 1.3) => parciales(t, f, [[1, 0.5, d], [3.0, 0.12, d * 0.4], [4.1, 0.05, d * 0.25]], dest, g, 0.003);
  const vibra = (t, d, dest, g = 1) => { const bp = nodo.filtro('bandpass', 360, 2.5), x = nodo.gan(0); cadena(bp, x, dest); osc('square', 172, t, t + d, bp); osc('square', 344.5, t, t + d, bp); env(x.gain, [[t, 0], [t + 0.02, 0.09 * g], [t + d - 0.03, 0.09 * g], [t + d, 0]]); const hp = nodo.filtro('highpass', 1800, 0.8), y = nodo.gan(0); cadena(hp, y, dest); tocar(H.blanco, t, hp, { desde: 0.5, dura: d }); env(y.gain, [[t, 0], [t + 0.02, 0.025 * g], [t + d, 0]]); };
  const zumbido = (t, d, f0, f1, g, dest, q = 1, tipo = 'pink') => { const bp = nodo.filtro('bandpass', f0, q), x = nodo.gan(0); cadena(bp, x, dest); tocar(tipo === 'pink' ? H.pink : H.blanco, t, bp, { desde: (t * 0.37) % 2, dura: d + 0.05 }); envExp(bp.frequency, [[t, f0], [t + d, f1]]); env(x.gain, [[t, 0], [t + d * 0.55, g], [t + d, 0]]); };
  const granos = (t0, t1, porSeg, f0, f1, g, dest, q = 2, dura = 0.02) => { let t = t0; while (t < t1) { const u = (t - t0) / Math.max(1e-3, t1 - t0), bp = nodo.filtro('bandpass', lerp(f0, f1, R()), q), x = nodo.gan(0), p = nodo.pan((R() - .5) * 0.8); cadena(bp, x, p, dest); tocar(H.blanco, t, bp, { desde: R() * 2.5, dura }); env(x.gain, [[t, 0], [t + 0.002, g * (0.5 + R() * 0.5)], [t + dura, 0]]); t += (1 / (typeof porSeg === 'function' ? porSeg(u) : porSeg)) * (0.4 + R() * 1.2); } };
  const golpeGrave = (t, f0, f1, d, g, dest) => { const o = ac.createOscillator(), x = nodo.gan(0); o.type = 'sine'; envExp(o.frequency, [[t, f0], [t + d * 0.4, f1]]); o.connect(x); x.connect(dest); o.start(t); o.stop(t + d + 0.05); envExp(x.gain, [[t, 1e-4], [t + 0.003, g], [t + d, 1e-4]]); };
  const murmullo = (t0, t1, curva, dest, semilla = 1) => { const r = rng(semilla); for (const [f, q, g] of [[320, 1.1, .05], [850, 1.4, .045], [2300, 2.2, .018]]) { const bp = nodo.filtro('bandpass', f, q), a = nodo.gan(0), p = nodo.pan((r() - .5) * .7); cadena(bp, a, p, dest); tocar(H.pink, t0, bp, { desde: r() * 3, dura: t1 - t0 + 0.1 }); let t = t0; a.gain.setValueAtTime(0, t0); while (t < t1) { t += .12 + r() * .2; a.gain.linearRampToValueAtTime(g * (.35 + r() * .9) * curva(t), t); } a.gain.linearRampToValueAtTime(0, t1 + 0.1); } };
  const acorde = (t0, t1, notas, pts, lp, dest) => { const f = nodo.filtro('lowpass', 600, .5), x = nodo.gan(0); cadena(f, x, dest); env(x.gain, pts); envExp(f.frequency, lp); for (const [hz, d] of notas) { osc('sawtooth', hz, t0, t1, f, d); osc('sawtooth', hz, t0, t1, f, d + 8); } };

  // ---------- buses ----------
  const seco = envios(master, 0, 0.25), cuarto = envios(master, 0.9, 0), abierto = envios(master, 0, 1.0), salon = envios(master, 0.5, 0);

  // ---------- 1. la calle al atardecer (0–5) ----------
  { const lp = nodo.filtro('lowpass', 320, .6), x = nodo.gan(0); cadena(lp, x, abierto); tocar(H.marron, 0, lp, { dura: 6 }); env(x.gain, [[0, 0], [0.4, 0.11], [4.2, 0.09], [5.0, 0]]); }
  zumbido(0.6, 2.4, 300, 1400, 0.09, abierto, 1.2); zumbido(1.4, 1.8, 1400, 380, 0.07, abierto, 1.4); // un auto que pasa
  { const g = nodo.gan(0), p = nodo.pan(0.3); cadena(g, p, abierto); env(g.gain, [[0, 1], [1, 1]]); for (const [t, f] of [[1.1, 3400], [1.32, 4200], [2.9, 3800]]) { const o = ac.createOscillator(), x = nodo.gan(0); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.09); o.connect(x); x.connect(g); o.start(t); o.stop(t + 0.12); env(x.gain, [[t, 0], [t + 0.01, 0.025], [t + 0.1, 0]]); } } // pájaros de la tarde
  murmullo(0, 10.3, t => lerp(0.15, 1, smooth(1.5, 5, t)) * (t > 8.15 ? lerp(1, 0.4, smooth(8.15, 8.5, t)) : 1) * (1 - smooth(9.8, 10.3, t)), salon, 21);
  for (const t of [3.7, 4.25, 5.6, 6.3]) parciales(t, 3100 + R() * 900, [[1, 0.35, 0.5], [2.71, 0.15, 0.3], [5.2, 0.06, 0.15]], salon, 0.12); // copas
  zumbido(4.3, 0.7, 500, 2200, 0.1, seco, 0.9); // cruzar la puerta

  // ---------- 2. el salón, el delantal, la vibración (5–10) ----------
  { const lp = nodo.filtro('lowpass', 8000, .5), x = nodo.gan(0); cadena(lp, x, salon); envExp(lp.frequency, [[5, 8000], [8.1, 8000], [8.5, 900], [9.9, 1200]]); for (let i = 0; i < 10; i++) { const t = 5 + R() * 3.4; parciales(t, 1500 + R() * 2500, [[1, 0.4, 0.2], [2.7, 0.2, 0.12]], x, 0.06); } env(x.gain, [[5, 1], [9.9, 1], [10.2, 0]]); }
  vibra(8.15, 0.5, seco, 1.2); vibra(8.75, 0.5, seco, 1.2);
  { const x = nodo.gan(0); x.connect(abierto); env(x.gain, [[6.2, 0], [7.2, 0.03], [9.6, 0.02], [10.2, 0]]); for (const [f, d] of [[73.42, -5], [110, 4], [146.83, 0]]) osc('sawtooth', f, 6.2, 10.3, (() => { const lp = nodo.filtro('lowpass', 420, .8); lp.connect(x); return lp; })(), d); } // un bordón grave para «Falta uno.»

  // ---------- 3. la escena terminada, montada a los 10 s ----------
  { const s3 = ac.createBufferSource(), g3 = nodo.gan(0); s3.buffer = b3; s3.connect(g3); g3.connect(master); env(g3.gain, [[10, 1], [20.25, 1], [20.85, 0]]); s3.start(10); }

  // ---------- 4. arriba de las nubes (20–26) ----------
  { const vb = nodo.filtro('bandpass', 600, .5), vg = nodo.gan(0); cadena(vb, vg, abierto); tocar(H.pink, 20, vb, { desde: 1, dura: 10 }); env(vg.gain, [[20, 0], [20.5, 0.22], [22.6, 0.3], [23.6, 0.08], [26, 0.12], [27.5, 0.35], [29.6, 0]]); envExp(vb.frequency, [[20, 900], [22.6, 1400], [23.6, 400], [26, 500], [28.5, 1600], [29.6, 300]]); }
  acorde(20, 30.2, [[146.83, -4], [220, 5], [293.66, -3], [329.63, 4], [392, -6], [440, 3]], [[20, 0], [20.6, 0.045], [23.4, 0.05], [26, 0.03], [29.4, 0.02], [29.8, 0]], [[20, 2600], [23.4, 3200], [27, 1400], [29.8, 400]], abierto);
  golpeGrave(21.2, 60, 38, 2.2, 0.35, abierto); // «La noche entera.»
  nota(23.6, 1174.66, 0.2, abierto, 2.2); nota(23.62, 1760, 0.12, abierto, 2.0); // la flecha en la punta

  // ---------- 5. la picada, la ventana, dos llamadas (26–33) ----------
  zumbido(26.3, 2.2, 400, 3200, 0.35, abierto, 0.8); zumbido(28.3, 1.4, 3000, 300, 0.3, abierto, 0.9, 'blanco');
  golpeGrave(27.4, 70, 45, 1.2, 0.25, abierto); // «Llamás.»
  { const lp = nodo.filtro('lowpass', 260, .6), x = nodo.gan(0); cadena(lp, x, cuarto); tocar(H.marron, 29.5, lp, { desde: 2, dura: 4 }); env(x.gain, [[29.5, 0], [29.9, 0.05], [32.9, 0.04], [33.3, 0]]); } // el cuarto: la ciudad apagada del otro lado del vidrio
  for (const [t0, t1] of [[29.9, 31.15], [31.55, 32.55]]) { for (let t = t0; t < t1 - 0.2; t += 0.52) { nota(t, 1318.5, 0.22, cuarto, 0.4); nota(t + 0.13, 987.77, 0.2, cuarto, 0.4); nota(t + 0.26, 1661.2, 0.18, cuarto, 0.5); } vibra(t0, 0.45, cuarto, 1.6); vibra(t0 + 0.55, 0.45, cuarto, 1.6); }

  // ---------- 6. «Cantalo.»: la birome, la hoja que se arranca y un soplo (33–39) ----------
  { const lp = nodo.filtro('lowpass', 240, .8), x = nodo.gan(0); cadena(lp, x, seco); osc('sawtooth', 50, 33.2, 39.2, lp); env(x.gain, [[33.2, 0], [33.6, 0.008], [39, 0.008], [39.3, 0]]); }
  { const bp = nodo.filtro('bandpass', 4200, 1.4), x = nodo.gan(0); cadena(bp, x, cuarto); tocar(H.blanco, 33.7, bp, { desde: 0.2, dura: 2.8 }); x.gain.setValueAtTime(0, 33.7); let t = 33.7; while (t < 36.4) { const trazo = 0.05 + R() * 0.12; x.gain.linearRampToValueAtTime(0.09 + R() * 0.07, t + 0.01); x.gain.linearRampToValueAtTime(0.01, t + trazo); t += trazo + (R() < 0.15 ? 0.12 : 0.02); } x.gain.linearRampToValueAtTime(0, 36.5); }
  golpeGrave(34.3, 80, 52, 0.8, 0.22, seco); // «Cantalo.»
  granos(36.85, 37.15, 140, 2000, 6000, 0.28, cuarto, 2.5, 0.012); // se arranca la hoja
  zumbido(37.0, 0.9, 500, 1100, 0.14, seco, 0.8); // un soplo
  zumbido(38.6, 0.9, 700, 2600, 0.12, abierto, 1.0); // sale por la puerta
  for (let k = 0; k < 4; k++) parciales(37.2 + k * 0.5, 1700 + k * 220, [[1, 0.3, 0.3]], seco, 0.03);

  // ---------- 7. «Cerca. Todos a la vez.»: una nota por cada luz (39–47) ----------
  { const vb = nodo.filtro('bandpass', 700, .45), vg = nodo.gan(0); cadena(vb, vg, abierto); tocar(H.pink, 39, vb, { desde: 2, dura: 9 }); env(vg.gain, [[39, 0], [40, 0.12], [46, 0.1], [47.4, 0.02]]); }
  const escala = [587.33, 659.25, 739.99, 880, 987.77]; // re mayor pentatónica
  [[40.3, 587.33], [41.0, 880], [41.6, 739.99], [42.2, 659.25], [42.7, 987.77]].forEach(([t, f]) => nota(t, f, 0.22, abierto, 2.2));
  { let t = 43.2; while (t < 46.8) { const u = (t - 43.2) / 3.6, f = escala[Math.floor(R() * 5)] * [0.5, 1, 1, 2][Math.floor(R() * 4)]; nota(t, f, 0.06 + 0.06 * (1 - u), abierto, 1.6); t += 1 / (3 + u * 26) * (0.5 + R()); } }
  acorde(43.0, 53.8, [[146.83, -3], [220, 4], [293.66, 0], [369.99, -4], [440, 3], [659.25, -2]], [[43, 0], [45.5, 0.04], [47.4, 0.035], [52.5, 0.02], [53.6, 0]], [[43, 500], [46.5, 2800], [49, 1500], [53.6, 600]], abierto);

  // ---------- 8. «Voy.»: la puerta, los pasos, la bici (47–53.6) ----------
  { const lp = nodo.filtro('lowpass', 300, .6), x = nodo.gan(0); cadena(lp, x, abierto); tocar(H.marron, 47, lp, { desde: 9, dura: 7 }); env(x.gain, [[47, 0], [47.5, 0.07], [53.2, 0.06], [53.6, 0]]); }
  { const bp = nodo.filtro('bandpass', 900, 5), x = nodo.gan(0); cadena(bp, x, abierto); const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, 47.4); for (let t = 47.4; t < 48.2; t += 0.05) o.frequency.linearRampToValueAtTime(85 + R() * 30, t); o.connect(bp); o.start(47.4); o.stop(48.3); env(x.gain, [[47.4, 0], [47.5, 0.12], [48.1, 0.06], [48.25, 0]]); parciales(47.36, 1900, [[1, 0.4, 0.06], [2.3, 0.2, 0.04]], abierto, 0.2); }
  golpeGrave(48.4, 90, 55, 0.7, 0.25, seco); // «Voy.»
  for (let t = 48.3; t < 52.7; t += 0.52 + R() * 0.04) { golpeGrave(t, 110, 62, 0.12, 0.18, abierto); granos(t, t + 0.04, 400, 2500, 5000, 0.05, abierto, 1.5, 0.015); }
  { const ruedas = nodo.pan(-0.9); ruedas.connect(abierto); env(ruedas.pan, [[50.4, -0.9], [51.8, 0.9]]); granos(50.45, 51.8, 22, 3200, 3800, 0.08, ruedas, 3, 0.008); zumbido(50.4, 1.4, 600, 2400, 0.14, ruedas, 0.7); parciales(50.9, 2600, [[1, 0.5, 0.5], [2.1, 0.2, 0.3]], ruedas, 0.08); }
  zumbido(51.3, 1.6, 400, 2600, 0.2, seco, 0.8); // de vuelta al bodegón, de un tirón
  murmullo(51.8, 64, t => smooth(51.8, 52.6, t) * lerp(0.5, 0.9, smooth(57, 59, t)) * (1 - smooth(62.8, 64, t)), salon, 33);

  // ---------- 9. «¡Oído!»: la columna de papel cae, el sello, la campanita (53.6–57) ----------
  granos(52.6, 54.4, u => 30 + 160 * Math.sin(Math.PI * u), 1500, 5500, 0.12, salon, 2, 0.03); // la pila que se desarma
  zumbido(52.6, 1.8, 2500, 900, 0.12, salon, 0.7, 'blanco');
  golpeGrave(54.6, 120, 60, 0.5, 0.6, seco); // el sello sobre la comanda
  campana(54.6, 1.0, abierto); // la campanita del pase, una sola vez
  granos(54.7, 57.5, u => 40 * (1 - u) + 6, 2500, 6500, 0.05, salon, 2.2, 0.02); // papel picado
  acorde(54.6, 64.5, [[146.83, 0], [185, -3], [220, 4], [293.66, -2], [369.99, 3], [440, -4]], [[54.6, 0], [55.4, 0.05], [58, 0.035], [63, 0.025], [64.4, 0]], [[54.6, 900], [56, 3200], [63, 1800], [64.4, 500]], abierto); // re mayor: resuelve

  // ---------- 10. «Sale.»: platos que salen, copas que brindan (57–63) ----------
  for (const t of [57.15, 57.27, 57.39]) { const bp = nodo.filtro('bandpass', 1700, 2.2), x = nodo.gan(0); cadena(bp, x, salon); tocar(H.blanco, t, bp, { desde: 1, dura: 0.5 }); x.gain.setValueAtTime(0, t); for (let k = 0; k < 14; k++) x.gain.linearRampToValueAtTime(0.06 * (0.4 + R() * 0.6), t + 0.03 * k); x.gain.linearRampToValueAtTime(0, t + 0.45); parciales(t + 0.45, 2400, [[1, 0.3, 0.12], [2.6, 0.15, 0.08]], salon, 0.1); }
  golpeGrave(57.4, 90, 60, 0.6, 0.2, seco); // «Sale.»
  for (let k = 0; k < 4; k++) parciales(60.4 + k * 0.013 + R() * 0.01, 3000 + k * 420, [[1, 0.5, 0.9], [2.71, 0.2, 0.5], [5.4, 0.08, 0.3]], salon, 0.16, 0.001); // el brindis
  for (let i = 0; i < 12; i++) { const t = 57.6 + R() * 5; parciales(t, 1800 + R() * 2500, [[1, 0.4, 0.2], [2.7, 0.15, 0.1]], salon, 0.05); } // cubiertos

  // ---------- 11. el cielo, la pregunta, «oído» (63–68) ----------
  zumbido(63.0, 1.6, 300, 1800, 0.12, abierto, 0.8);
  { const vb = nodo.filtro('bandpass', 500, .45), vg = nodo.gan(0); cadena(vb, vg, abierto); tocar(H.pink, 63.3, vb, { desde: 4, dura: 5 }); env(vg.gain, [[63.3, 0], [64.5, 0.06], [67.5, 0.05], [68, 0]]); }
  campana(65.5, 0.4, abierto); // un último toque, suave
  { const x = nodo.gan(0); x.connect(abierto); env(x.gain, [[64.6, 0], [65.6, 0.02], [67.6, 0.012], [68, 0]]); for (const f of [293.66, 440, 587.33, 739.99]) { const lp = nodo.filtro('lowpass', 1500, .5); lp.connect(x); osc('triangle', f, 64.6, 68, lp, (R() - .5) * 8); } }

  // ---------- extra (70–73,6): el aviso del turno en el celular de la habitación, para el corte «Voy» ----------
  if (dur > 70) {
    { const lp = nodo.filtro('lowpass', 260, .6), x = nodo.gan(0); cadena(lp, x, cuarto); tocar(H.marron, 69.8, lp, { desde: 3, dura: 4.2 }); env(x.gain, [[69.8, 0], [70.1, 0.05], [dur - 0.2, 0.05], [dur, 0]]); }
    nota(70.4, 1318.5, 0.25, cuarto, 0.9); nota(70.55, 1760, 0.2, cuarto, 1.2); vibra(70.4, 0.4, cuarto, 1.5);
    acorde(70.6, dur, [[293.66, -3], [369.99, 4], [440, 0], [587.33, -2]], [[70.6, 0], [72, 0.025], [dur, 0.03]], [[70.6, 600], [dur, 2200]], abierto);
  }
  return await ac.startRendering();
}

// AudioBuffer → WAV de 24 bits
export function wav(b) {
  const n = b.length, ch = b.numberOfChannels, sr = b.sampleRate, bps = 3, datos = n * ch * bps, ab = new ArrayBuffer(44 + datos), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + datos, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * bps, true); v.setUint16(32, ch * bps, true); v.setUint16(34, 24, true); w(36, 'data'); v.setUint32(40, datos, true);
  const cs = Array.from({ length: ch }, (_, c) => b.getChannelData(c)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { let x = Math.max(-1, Math.min(1, cs[c][i])) * 8388607; x = Math.round(x); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; }
  return new Uint8Array(ab);
}
