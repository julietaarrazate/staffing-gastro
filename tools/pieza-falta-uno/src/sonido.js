// Banda de sonido sintetizada, calculada sin tiempo real (OfflineAudioContext), alineada al cuadro con la misma línea de tiempo que la imagen.
// Nada grabado ni de catálogo: ruido filtrado, senos con envolventes, reverberación por convolución con salas generadas.
import { rng, clamp, lerp, smooth } from './util.js';

export async function bandaEscena3({ GOLPES, crece, camY, TECHO }, { dur = 10, sr = 48000 } = {}) {
  const ac = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(dur * sr), sampleRate: sr });
  const R = rng(4242);

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
  const salida = nodo.gan(0.95);
  cadena(master, comp, lim, salida); salida.connect(ac.destination);
  const conv = (b, g) => { const c = ac.createConvolver(); c.normalize = true; c.buffer = b; const o = nodo.gan(g); cadena(c, o, master); return c; };
  const salaCocina = conv(sala(0.9, 0.7, 11, .75, .006), 0.9);
  const salaAbierta = conv(sala(4.2, 3.6, 23, .55, .03), 1.0);
  const envios = (dest, cocina, abierta) => { const n = nodo.gan(1); n.connect(dest); if (cocina) { const g = nodo.gan(cocina); n.connect(g); g.connect(salaCocina); } if (abierta) { const g = nodo.gan(abierta); n.connect(g); g.connect(salaAbierta); } return n; };

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
