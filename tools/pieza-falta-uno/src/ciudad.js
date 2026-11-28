// Buenos Aires de noche: manzanas de cien metros, ventanas prendidas, faroles, la alfombra de luces hasta el horizonte,
// el cielo de la hora azul y un techo de nubes iluminado desde abajo por la ciudad (por raymarching).
import * as THREE from 'three';
import { rng, kelvin } from './util.js';

const NIEBLA = `uniform vec3 uNiebla; uniform float uDens; vec3 niebla(vec3 c, float d){ return mix(c, uNiebla, 1. - exp(-uDens * uDens * d * d)); }`;

export function crearCiudad(escena, { radio = 1300 } = {}) {
  const g = new THREE.Group(); escena.add(g);
  const r = rng(303);
  const niebla = { uNiebla: { value: new THREE.Color(0.035, 0.045, 0.08) }, uDens: { value: 0.00055 } };

  // edificios: cajas instanciadas sobre el damero (calles cada 100 m, manzanas de 86,6 m)
  const cajas = [];
  const lote = 86.6, paso = 100;
  for (let bx = -Math.ceil(radio / paso); bx <= Math.ceil(radio / paso); bx++) for (let bz = -Math.ceil(radio / paso); bz <= Math.ceil(radio / paso); bz++) {
    const cx = bx * paso, cz = bz * paso; if (Math.hypot(cx, cz) > radio) continue;
    const torre = r() < 0.1;
    for (let lado = 0; lado < 4; lado++) {
      let s = -lote / 2;
      while (s < lote / 2 - 4) {
        const ancho = Math.min(lote / 2 - s, 8.66 * (1 + Math.floor(r() * 3))), fondo = 12 + r() * 16;
        let alto = 6 + r() * 14; if (r() < 0.25) alto = 18 + r() * 22; if (torre && r() < 0.3) alto = 45 + r() * 70;
        const enX = lado % 2 === 0, signo = lado < 2 ? 1 : -1;
        const px = enX ? cx + s + ancho / 2 : cx + signo * (lote / 2 - fondo / 2);
        const pz = enX ? cz + signo * (lote / 2 - fondo / 2) : cz + s + ancho / 2;
        // el lote propio (x≈0, z≈0) queda libre: ahí está el bodegón
        if (Math.abs(px) < 14 && Math.abs(pz) < 22) { s += ancho; continue; }
        cajas.push([px, pz, enX ? ancho : fondo, enX ? fondo : ancho, alto, r()]);
        s += ancho;
      }
    }
  }
  // vecinos inmediatos, a mano: el edificio de atrás y el de la derecha (con ventanas que se ven desde la azotea)
  cajas.push([0, -24, 8.66, 12, 34, 0.37], [9.5, -4, 8.66, 22, 12.5, 0.71], [-9.5, -14, 8.66, 18, 26, 0.13], [10, 14, 8.66, 16, 21, 0.52], [-18, 6, 8.66, 26, 17, 0.9]);
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.getAttribute('position')); ig.setAttribute('normal', geo.getAttribute('normal'));
  const n = cajas.length, aCaja = new Float32Array(n * 4), aDim = new Float32Array(n * 3);
  cajas.forEach(([x, z, w, d, h, s], i) => { aCaja.set([x, z, s, 0], i * 4); aDim.set([w, h, d], i * 3); });
  ig.setAttribute('aCaja', new THREE.InstancedBufferAttribute(aCaja, 4)); ig.setAttribute('aDim', new THREE.InstancedBufferAttribute(aDim, 3)); ig.instanceCount = n;
  const [wr, wg, wb] = kelvin(2700), [cr, cg, cb] = kelvin(6500);
  const matEd = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...niebla, uCalida: { value: new THREE.Vector3(wr, wg, wb) }, uFria: { value: new THREE.Vector3(cr * .7, cg * .85, cb * 1.2) }, uPiso: { value: -0.95 } },
    vertexShader: `in vec4 aCaja; in vec3 aDim; uniform float uPiso; out vec3 vW; out vec3 vN; out float vS; out vec3 vDim; out vec3 vLoc;
      void main(){ vec3 p = position * aDim; p.y += uPiso; p.xz += aCaja.xy; vW = p; vN = normal; vS = aCaja.z; vDim = aDim; vLoc = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `${NIEBLA} uniform vec3 uCalida, uFria; in vec3 vW; in vec3 vN; in float vS; in vec3 vDim; in vec3 vLoc; out vec4 o;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec3 c;
        if(vN.y > .5){ c = vec3(.012, .013, .018); }
        else {
          float u = abs(vN.x) > .5 ? vLoc.z * vDim.z : vLoc.x * vDim.x;
          vec2 q = vec2(u + vS * 7.3, vW.y + 0.95);
          vec2 cel = floor(q / vec2(1.7, 2.9)), f = fract(q / vec2(1.7, 2.9));
          float ven = smoothstep(.16, .2, f.x) * smoothstep(.84, .8, f.x) * smoothstep(.22, .26, f.y) * smoothstep(.82, .78, f.y);
          float h = h21(cel + vS * 31.7), h2 = h21(cel * 1.7 + vS * 3.1 + 9.), h3 = h21(cel.yx + vS * 11.);
          float prende = step(.7 - vS * .15, h) * step(1.5, q.y);
          vec3 luz = (h2 > .86 ? uFria : uCalida) * (.2 + 1.3 * h3 * h3) * (.55 + .45 * f.y); ven *= smoothstep(.02, .05, abs(f.x - .5));
          float cortina = .55 + .45 * smoothstep(.2, .8, fract(f.x * 3. + h2 * 5.));
          vec3 pared = vec3(.017, .016, .018) * (.6 + .4 * h21(vec2(vS, 3.)));
          c = mix(pared, luz * cortina * 1.1, ven * prende) + ven * (1. - prende) * vec3(.012, .02, .04) * (.5 + f.y);
          // planta baja: locales con luz
          float pb = step(q.y, 3.2) * step(.55, h21(vec2(floor(u / 6.), vS)));
          c += pb * uCalida * .9 * smoothstep(.0, 1.5, q.y);
        }
        float d = length(vW - cameraPosition); o = vec4(niebla(c, d), 1.); }`,
  });
  const edificios = new THREE.Mesh(ig, matEd); edificios.frustumCulled = false; g.add(edificios);

  // tanques de agua en las azoteas cercanas (siluetas contra el cielo)
  const cerca = cajas.filter(c => Math.hypot(c[0], c[1]) < 450 && c[4] < 40);
  const tanques = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 20), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8 }), cerca.length);
  let nt = 0; const mt = new THREE.Matrix4();
  for (const [x, z, w, d, h, s] of cerca) { if (s > 0.55) continue; const rad = 0.55 + s * 0.6; mt.compose(new THREE.Vector3(x + (s - .25) * w * .6, -0.95 + h + 0.7 + 0.7, z + (s - .3) * d * .5), new THREE.Quaternion(), new THREE.Vector3(rad, 1.4, rad)); tanques.setMatrixAt(nt++, mt); }
  tanques.count = nt; g.add(tanques);
  // calle y vereda: plano oscuro
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { ...niebla }, vertexShader: `out vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: `${NIEBLA} in vec3 vW; out vec4 o; void main(){ o = vec4(niebla(vec3(.01, .009, .01), length(vW - cameraPosition)), 1.); }` }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.96; g.add(suelo);

  // faroles en las calles y la alfombra de luces hasta el horizonte (al este, el río: oscuro)
  const pts = [], col = [];
  const farol = (x, y, z, k, b) => { pts.push(x, y, z); const c = kelvin(k); col.push(c[0] * b, c[1] * b, c[2] * b); };
  for (let s = -radio; s <= radio; s += 100) for (let u = -radio; u <= radio; u += 32) {
    if (Math.hypot(s, u) > radio) continue;
    const k = r() < 0.6 ? 3800 : 2100;
    farol(s + 50 + (r() < .5 ? -5.5 : 5.5), 6.5, u, k, 30 + r() * 20); farol(u, 6.5, s + 50 + (r() < .5 ? -5.5 : 5.5), k, 30 + r() * 20);
  }
  for (let i = 0; i < 26000; i++) {
    const a = r() * Math.PI * 2, d = radio + Math.pow(r(), 0.7) * 14000, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (x > 3500 + Math.sin(z * 0.0004) * 600) continue; // el río
    farol(x, 4 + r() * 30, z, r() < .5 ? 2200 : 4000, 40 + r() * 60);
  }
  const geoF = new THREE.BufferGeometry(); geoF.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geoF.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const matF = new THREE.ShaderMaterial({
    uniforms: { ...niebla, uPx: { value: 720 } },
    vertexShader: `attribute vec3 color; uniform float uPx; varying vec3 vC; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; vD = -mv.z; gl_PointSize = max(1.2, uPx * .5 / vD); vC = color / max(1., gl_PointSize * gl_PointSize * .25); }`,
    fragmentShader: `${NIEBLA} varying vec3 vC; varying float vD; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .1, d); gl_FragColor = vec4(niebla(vC * a, vD) * a, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const faroles = new THREE.Points(geoF, matF); faroles.frustumCulled = false; g.add(faroles);

  return { grupo: g, niebla, matF };
}

export function crearCielo(escena) {
  const [tr, tg, tb] = kelvin(1900);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false,
    uniforms: { uOeste: { value: new THREE.Vector3(-1, 0, -0.35).normalize() }, uCrep: { value: new THREE.Vector3(tr, tg, tb) }, uLuz: { value: 1 } },
    vertexShader: `out vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uOeste, uCrep; uniform float uLuz; in vec3 vD; out vec4 o;
      float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      void main(){ vec3 d = normalize(vD); float el = d.y;
        vec3 cenit = vec3(.003, .007, .022), medio = vec3(.01, .02, .05), horiz = vec3(.07, .06, .07);
        vec3 c = mix(horiz, medio, smoothstep(-.02, .22, el)); c = mix(c, cenit, smoothstep(.18, .85, el));
        c += vec3(.22, .11, .055) * exp(-max(el, 0.) * 12.) * .6; // resplandor de la ciudad en el horizonte
        float w = pow(max(dot(normalize(vec3(d.x, 0., d.z)), uOeste), 0.), 2.);
        c += uCrep * .22 * w * exp(-max(el, 0.) * 9.) + vec3(.03, .07, .14) * w * exp(-max(el, 0.) * 3.);
        // estrellas
        vec3 q = d * 420.; vec3 cel = floor(q); float h = h31(cel); float est = step(.9985, h) * smoothstep(.15, .6, el) * (.4 + .6 * h31(cel + 3.));
        float dd = length(fract(q) - .5); c += vec3(.8, .85, 1.) * est * smoothstep(.35, .0, dd) * .6;
        if(el < 0.) c = mix(horiz * .5, vec3(.012, .012, .016), smoothstep(0., -.08, el));
        o = vec4(c * uLuz, 1.); }`,
  });
  const domo = new THREE.Mesh(new THREE.SphereGeometry(20000, 64, 32), mat); domo.frustumCulled = false; domo.renderOrder = -1; escena.add(domo);
  return { domo, mat };
}

// Techo de nubes, de y0 a y1, iluminado desde abajo por la ciudad. Se dibuja a un cuarto de resolución y se compone con la profundidad de la escena.
export function crearNubes(motor, { y0 = 92, y1 = 160 } = {}) {
  const { THREE: TH } = motor, W = motor.W, H = motor.H;
  const rtN = motor.rt(W / 4, H / 4);
  const marcha = motor.pase(`
    uniform sampler2D tD; uniform mat4 uProjInv, uCamMat; uniform vec3 uCam; uniform float uNear, uFar, uT, uY0, uY1, uCob, uOn; uniform vec2 uEje;
    float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
    float h(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
      return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.; for(int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
    float dens(vec3 p){ float hh = (p.y - uY0) / (uY1 - uY0); float perfil = smoothstep(0., .25, hh) * smoothstep(1., .55, hh);
      vec3 q = p * .0115 + vec3(uT * .03, 0., uT * .012); float n = fbm(q) * .7 + fbm(q * 3.3) * .3;
      float torre = exp(-length(p.xz - uEje) / 60.) * .22; return smoothstep(1. - uCob, 1. - uCob + .16, n + torre) * perfil * 2.4; }
    void main(){
      if(uOn < .5){ o = vec4(0., 0., 0., 1.); return; }
      vec4 v = uProjInv * vec4(vUv * 2. - 1., 1., 1.); vec3 rv = normalize(v.xyz / v.w);
      vec3 rd = normalize((uCamMat * vec4(rv, 0.)).xyz);
      float z = lin(texture(tD, vUv).r); float tMax = z / max(-rv.z, 1e-3); if(texture(tD, vUv).r >= 1.) tMax = 1e5;
      if(abs(rd.y) < 1e-4){ o = vec4(0., 0., 0., 1.); return; }
      float ta = (uY0 - uCam.y) / rd.y, tb = (uY1 - uCam.y) / rd.y; float t0 = max(0., min(ta, tb)), t1 = min(max(ta, tb), min(tMax, 4500.));
      if(t1 <= t0){ o = vec4(0., 0., 0., 1.); return; }
      const int N = 30; float dt = (t1 - t0) / float(N); float j = fract(sin(dot(gl_FragCoord.xy + uT * 37., vec2(12.9898, 78.233))) * 43758.5453);
      float T = 1.; vec3 C = vec3(0.);
      for(int i = 0; i < N; i++){ vec3 p = uCam + rd * (t0 + (float(i) + j) * dt); float d = dens(p); if(d > .001){
          float hh = clamp((p.y - uY0) / (uY1 - uY0), 0., 1.);
          vec3 abajo = vec3(.5, .24, .12), arriba = vec3(.02, .035, .075);
          float sombra = exp(-dens(p + vec3(0., -9., 0.)) * 1.4);
          vec3 col = mix(abajo * (.25 + .75 * sombra), arriba, smoothstep(.0, .75, hh));
          float a = d * dt * .07; C += T * col * (1. - exp(-a)); T *= exp(-a); if(T < .02) break; } }
      float lejos = 1. - exp(-t0 * .00045); C = mix(C, vec3(.06, .06, .09) * (1. - T), lejos * .6);
      o = vec4(C, T); }`,
    { tD: null, uProjInv: new TH.Matrix4(), uCamMat: new TH.Matrix4(), uCam: new TH.Vector3(), uNear: .1, uFar: 100, uT: 0, uY0: y0, uY1: y1, uCob: .5, uOn: 1, uEje: new TH.Vector2() });
  const componer = motor.pase(`uniform sampler2D tN; void main(){ vec4 n = texture(tN, vUv); o = vec4(n.rgb, n.a); }`, { tN: null },
    { transparent: true, blending: TH.CustomBlending, blendSrc: TH.OneFactor, blendDst: TH.SrcAlphaFactor, blendEquation: TH.AddEquation });
  return {
    dibujar(r, escenaRT, cam, t, cobertura = .5, eje = [0, 0]) {
      marcha.u.uEje.value.set(eje[0], eje[1]);
      const u = marcha.u; u.tD.value = escenaRT.depthTexture; u.uProjInv.value.copy(cam.projectionMatrixInverse); u.uCamMat.value.copy(cam.matrixWorld); u.uCam.value.copy(cam.position);
      u.uNear.value = cam.near; u.uFar.value = cam.far; u.uT.value = t; u.uCob.value = cobertura;
      marcha.render(rtN); componer.u.tN.value = rtN.texture; componer.render(escenaRT);
    },
  };
}
