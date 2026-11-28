// Utilidades sin estado: todo lo que se dibuja es función del tiempo, así cualquier cuadro se puede dibujar solo.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = x => clamp(x, 0, 1);
export const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t, p = 3) => 1 - Math.pow(1 - sat(t), p);
export const easeIn = (t, p = 2) => Math.pow(sat(t), p);
export const TAU = Math.PI * 2;

// generador determinístico (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (n, s = 0) => { let x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

// deriva de cámara en mano: suma de senos con frecuencias que no coinciden
export const deriva = (t, s = 0) => Math.sin(t * 0.71 + s) * 0.55 + Math.sin(t * 1.13 + s * 2.1 + 1.3) * 0.3 + Math.sin(t * 2.37 + s * 3.7 + 0.4) * 0.15;

// oscilación amortiguada: el «rebote» de un golpe
export const rebote = (dt, frec = 9, amort = 7) => dt < 0 ? 0 : Math.exp(-dt * amort) * Math.sin(dt * frec * TAU);

// temperatura de color (K) a RGB lineal aproximado
export function kelvin(k) {
  const t = k / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const lin = c => { c = clamp(c / 255); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [lin(r), lin(g), lin(b)];
}

// curva monótona por puntos (Fritsch–Carlson): pasa por cada punto sin pasarse, ideal para tiempos y alturas
export function curva(pts, { log = false } = {}) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => log ? Math.log(p[1]) : p[1]), n = xs.length;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return x => {
    let y;
    if (x <= xs[0]) y = ys[0] + m[0] * (x - xs[0]) * 0; else if (x >= xs[n - 1]) y = ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    else {
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    }
    return log ? Math.exp(y) : y;
  };
}

// recorrido por puntos con tiempos [[t, x, y, z], ...] o escalares [[t, v], ...]: Catmull-Rom con tiempos no parejos (pasa por cada punto, sin quiebres)
export function ruta(keys) {
  const n = keys.length, dim = keys[0].length - 1;
  const tang = i => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)], dt = b[0] - a[0];
    return Array.from({ length: dim }, (_, k) => (i === 0 || i === n - 1) ? 0 : (b[k + 1] - a[k + 1]) / dt);
  };
  const T = keys.map((_, i) => tang(i));
  return t => {
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return Array.from({ length: dim }, (_, k) => h00 * a[k + 1] + h10 * h * T[i][k] + h01 * b[k + 1] + h11 * h * T[i + 1][k]);
  };
}
