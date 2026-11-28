// Motor de render propio: escena en HDR, desenfoque de movimiento por subcuadros (que además suaviza los bordes),
// profundidad de campo por mips con peso de profundidad, bloom de seis niveles y revelado (ACES, gradación, viñeta, grano, dither).
import * as THREE from 'three';

const VS = `out vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;
const COMUN = `
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
float hash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
`;

export function crearMotor(canvas, W, H) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.toneMapping = THREE.NoToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = true;
  r.autoClear = false;

  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const camQuad = new THREE.Camera();
  const pase = (frag, uniforms, opts = {}) => {
    const u = { uRes: { value: new THREE.Vector2(W, H) }, ...Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, v && typeof v === 'object' && 'value' in v ? v : { value: v }])) };
    const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: COMUN + frag, uniforms: u, depthTest: false, depthWrite: false, ...opts });
    const m = new THREE.Mesh(tri, mat); m.frustumCulled = false; const sc = new THREE.Scene(); sc.add(m);
    return { u, mat, render(target, clear = false) { if (target) u.uRes.value.set(target.width, target.height); else u.uRes.value.set(W, H); r.setRenderTarget(target); if (clear) r.clear(true, false, false); r.render(sc, camQuad); } };
  };
  const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, ...o });

  const escenaRT = rt(W, H, { depthBuffer: true });
  escenaRT.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
  const accRT = rt(W, H), dofRT = rt(W, H);
  const NDOF = 4, dofMips = [], NB = 6, bajan = [], suben = [];
  for (let i = 0; i < NDOF; i++) dofMips.push(rt(W / (2 << i), H / (2 << i)));
  for (let i = 0; i < NB; i++) { bajan.push(rt(W / (2 << i), H / (2 << i))); suben.push(rt(W / (2 << i), H / (2 << i))); }

  // suma ponderada de subcuadros
  const sumar = pase(`uniform sampler2D tA; uniform float uW; void main(){ o = vec4(texture(tA, vUv).rgb * uW, 1.); }`,
    { tA: null, uW: 1 }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });

  // profundidad de campo: el primer nivel pondera cada muestra por su círculo de confusión (así el fondo no se mancha con lo que está en foco)
  const dofBaja = pase(`uniform sampler2D tA, tD; uniform vec2 uPx; uniform float uPrim, uFoco, uApert, uNear, uFar;
    float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
    float coc(vec2 uv){ float z = lin(texture(tD, uv).r); return uApert * abs(z - uFoco) / max(z, 1e-3); }
    vec4 s(vec2 d){ vec2 uv = vUv + d * uPx; if(uPrim > .5){ float c = coc(uv); float w = smoothstep(.6, 2.2, c); return vec4(texture(tA, uv).rgb * w, w); } return texture(tA, uv); }
    void main(){ vec4 c = s(vec2(0)) * .125 + (s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1))) * .125
      + (s(vec2(-2,0)) + s(vec2(2,0)) + s(vec2(0,-2)) + s(vec2(0,2))) * .0625 + (s(vec2(-2,-2)) + s(vec2(2,-2)) + s(vec2(-2,2)) + s(vec2(2,2))) * .03125; o = c; }`,
    { tA: null, tD: null, uPx: new THREE.Vector2(), uPrim: 0, uFoco: 1, uApert: 0, uNear: .1, uFar: 100 });
  const dofMezcla = pase(`uniform sampler2D tA, tD, t1, t2, t3, t4; uniform float uFoco, uApert, uNear, uFar;
    float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
    vec3 nivel(sampler2D t){ vec4 c = texture(t, vUv); return c.rgb / max(c.a, 1e-4); }
    void main(){ vec3 c0 = texture(tA, vUv).rgb; if(uApert <= 0.){ o = vec4(c0, 1.); return; }
      float z = lin(texture(tD, vUv).r); float coc = uApert * abs(z - uFoco) / max(z, 1e-3);
      float f = clamp(log2(max(coc, 1.)), 0., 3.999); vec4 a4 = texture(t4, vUv);
      vec3 l1 = nivel(t1), l2 = nivel(t2), l3 = nivel(t3), l4 = nivel(t4);
      vec3 c = f < 1. ? mix(c0, l1, f) : f < 2. ? mix(l1, l2, f - 1.) : f < 3. ? mix(l2, l3, f - 2.) : mix(l3, l4, f - 3.);
      float w = texture(t1, vUv).a; c = mix(c0, c, smoothstep(.05, .5, w));
      o = vec4(c, 1.); }`,
    { tA: null, tD: null, t1: null, t2: null, t3: null, t4: null, uFoco: 1, uApert: 0, uNear: .1, uFar: 100 });

  // bloom: bajada con umbral suave y subida en carpa
  const bBaja = pase(`uniform sampler2D tA; uniform vec2 uPx; uniform float uUmbral, uPrim;
    vec3 s(vec2 d){ vec3 c = min(texture(tA, vUv + d * uPx).rgb, vec3(300.)); if(uPrim > .5){ float l = max(c.r, max(c.g, c.b)); float k = max(0., l - uUmbral) / max(l, 1e-4); c *= k; c /= 1. + luma(c) * .1; } return c; }
    void main(){ vec3 c = s(vec2(0)) * .125 + (s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1))) * .125
      + (s(vec2(-2,0)) + s(vec2(2,0)) + s(vec2(0,-2)) + s(vec2(0,2))) * .0625 + (s(vec2(-2,-2)) + s(vec2(2,-2)) + s(vec2(-2,2)) + s(vec2(2,2))) * .03125; o = vec4(c, 1.); }`,
    { tA: null, uPx: new THREE.Vector2(), uUmbral: 1, uPrim: 0 });
  const bSube = pase(`uniform sampler2D tA, tB; uniform vec2 uPx; uniform float uRadio;
    void main(){ vec3 c = vec3(0); for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){ float w = (x == 0 ? 2. : 1.) * (y == 0 ? 2. : 1.); c += w * texture(tA, vUv + vec2(x, y) * uPx).rgb; }
      o = vec4(texture(tB, vUv).rgb + c / 16. * uRadio, 1.); }`,
    { tA: null, tB: null, uPx: new THREE.Vector2(), uRadio: .85 });

  // revelado final
  const revela = pase(`uniform sampler2D tA, tB, tTexto; uniform float uExp, uBloom, uCon, uSat, uVig, uGrano, uCA, uHal, uTiempo, uNegro, uTextoOn; uniform vec3 uLift, uGain;
    vec3 rrt(vec3 v){ vec3 a = v * (v + .0245786) - .000090537; vec3 b = v * (.983729 * v + .4329510) + .238081; return a / b; }
    vec3 aces(vec3 c){ const mat3 I = mat3(vec3(.59719,.07600,.02840), vec3(.35458,.90834,.13383), vec3(.04823,.01566,.83777));
      const mat3 O = mat3(vec3(1.60475,-.10208,-.00327), vec3(-.53108,1.10813,-.07276), vec3(-.07367,-.00605,1.07602)); return clamp(O * rrt(I * c), 0., 1.); }
    vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){ vec2 d = vUv - .5; vec3 c;
      if(uCA > 0.){ vec2 k = d * dot(d, d) * uCA; c = vec3(texture(tA, vUv - k).r, texture(tA, vUv).g, texture(tA, vUv + k).b); } else c = texture(tA, vUv).rgb;
      vec3 b = texture(tB, vUv).rgb; c = max(c, 0.) + b * uBloom * vec3(1. + uHal * .4, 1. - uHal * .05, 1. - uHal * .45);
      c = aces(c * uExp / .6); c = srgb(c);
      c = (c - .5) * uCon + .5; c = mix(vec3(luma(c)), c, uSat); c = c * uGain + uLift * (1. - c);
      c *= 1. - uVig * smoothstep(.2, 1.1, length(d * vec2(uRes.x / uRes.y, 1.) * 1.15));
      if(uTextoOn > .5){ vec4 tx = texture(tTexto, vUv); c = mix(c, tx.rgb, tx.a); }
      c *= 1. - uNegro;
      float n = hash13(vec3(gl_FragCoord.xy, fract(uTiempo * 7.31) * 97.)); c += (n - .5) * uGrano * (1. - abs(luma(c) - .45) * 1.2);
      float dz = hash13(vec3(gl_FragCoord.xy, fract(uTiempo) * 61.)) + hash13(vec3(gl_FragCoord.xy, fract(uTiempo) * 61. + 7.)) - 1.;
      o = vec4(clamp(c + dz / 255., 0., 1.), 1.); }`,
    { tA: null, tB: null, tTexto: null, uExp: 1, uBloom: 0, uCon: 1, uSat: 1, uVig: 0, uGrano: 0, uCA: 0, uHal: 0, uTiempo: 0, uNegro: 0, uTextoOn: 0, uLift: new THREE.Vector3(), uGain: new THREE.Vector3(1, 1, 1) });

  // Halton para el temblor de subpíxel entre subcuadros
  const halton = (i, b) => { let f = 1, x = 0; while (i > 0) { f /= b; x += f * (i % b); i = Math.floor(i / b); } return x; };

  return {
    renderer: r, W, H, pase, rt, THREE,
    // dibuja un cuadro: la escena da su estado a cada tiempo (escena.poner(t)) y sus ajustes de revelado (escena.revelado(t))
    cuadro(escena, t, { sub = 1, obtur = 1 / 60, texto = null } = {}) {
      const cam = escena.camara;
      for (let k = 0; k < sub; k++) {
        const tk = sub > 1 ? t + ((k + .5) / sub - .5) * obtur : t;
        escena.poner(tk);
        if (sub > 1) cam.setViewOffset(W, H, halton(k + 1, 2) - .5, halton(k + 1, 3) - .5, W, H); else cam.clearViewOffset();
        cam.updateProjectionMatrix();
        r.setRenderTarget(escenaRT); r.setClearColor(0x000000, 1); r.clear(true, true, false);
        r.render(escena.escena, cam);
        if (escena.despuesOpaco) escena.despuesOpaco(r, escenaRT, tk);
        sumar.u.tA.value = escenaRT.texture; sumar.u.uW.value = 1 / sub;
        if (k === 0) { r.setRenderTarget(accRT); r.setClearColor(0, 1); r.clear(true, false, false); }
        sumar.render(accRT);
      }
      cam.clearViewOffset(); cam.updateProjectionMatrix();
      const p = escena.revelado(t);
      // profundidad de campo
      let fuente = accRT;
      if (p.apertura > 0) {
        const dl = { uFoco: p.foco, uApert: p.apertura * H / 720, uNear: cam.near, uFar: cam.far };
        let src = accRT;
        for (let i = 0; i < NDOF; i++) {
          Object.assign(dofBaja.u.uPx, { value: dofBaja.u.uPx.value.set(1 / src.width, 1 / src.height) });
          dofBaja.u.tA.value = src.texture; dofBaja.u.tD.value = escenaRT.depthTexture; dofBaja.u.uPrim.value = i === 0 ? 1 : 0;
          for (const k in dl) dofBaja.u[k].value = dl[k];
          dofBaja.render(dofMips[i]); src = dofMips[i];
        }
        Object.assign(dofMezcla.u.tA, { value: accRT.texture }); dofMezcla.u.tD.value = escenaRT.depthTexture;
        dofMips.forEach((m, i) => dofMezcla.u['t' + (i + 1)].value = m.texture);
        for (const k in dl) dofMezcla.u[k].value = dl[k];
        dofMezcla.render(dofRT); fuente = dofRT;
      }
      // bloom
      let src = fuente;
      for (let i = 0; i < NB; i++) { bBaja.u.tA.value = src.texture; bBaja.u.uPx.value.set(1 / src.width, 1 / src.height); bBaja.u.uPrim.value = i === 0 ? 1 : 0; bBaja.u.uUmbral.value = p.umbral ?? 1; bBaja.render(bajan[i]); src = bajan[i]; }
      let arriba = bajan[NB - 1];
      for (let i = NB - 2; i >= 0; i--) { bSube.u.tA.value = arriba.texture; bSube.u.tB.value = bajan[i].texture; bSube.u.uPx.value.set(1 / arriba.width, 1 / arriba.height); bSube.u.uRadio.value = p.radio ?? .85; bSube.render(suben[i]); arriba = suben[i]; }
      const u = revela.u;
      u.tA.value = fuente.texture; u.tB.value = suben[0].texture; u.uExp.value = p.exposicion ?? 1; u.uBloom.value = (p.bloom ?? 0) / NB * 1.6;
      u.uCon.value = p.contraste ?? 1; u.uSat.value = p.saturacion ?? 1; u.uVig.value = p.vineta ?? 0; u.uGrano.value = p.grano ?? 0; u.uCA.value = p.ca ?? 0; u.uHal.value = p.halacion ?? 0;
      u.uLift.value.set(...(p.lift ?? [0, 0, 0])); u.uGain.value.set(...(p.gain ?? [1, 1, 1])); u.uTiempo.value = t; u.uNegro.value = p.negro ?? 0;
      u.uTextoOn.value = texto ? 1 : 0; u.tTexto.value = texto;
      revela.render(null);
    },
  };
}
