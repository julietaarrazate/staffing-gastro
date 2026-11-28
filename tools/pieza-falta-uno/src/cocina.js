// El pase de la cocina de un bodegón: mostrador de acero, el pinche, la lámpara de calor, la pared de azulejos,
// la barra de comandas colgadas, ollas, vapor, polvo en la luz; arriba el cielorraso con vigas y el agujero por donde sale la pila.
import * as THREE from 'three';
import { rng, kelvin } from './util.js';
import * as T from './texturas.js';

export const TECHO = 3.05, LOSA = 0.36, PISO = -0.95; // alturas respecto del mostrador (m)

export function crearCocina(escena) {
  const g = new THREE.Group(); escena.add(g);
  const r = rng(101);
  const acero = T.aceroCepillado();
  const matAcero = new THREE.MeshStandardMaterial({ color: 0xb4b6ba, metalness: 1, roughness: 0.26, roughnessMap: acero, envMapIntensity: 1.6 });
  const matAceroOscuro = new THREE.MeshStandardMaterial({ color: 0x5a5c60, metalness: 1, roughness: 0.4, roughnessMap: acero });
  const sombra = o => { o.castShadow = true; o.receiveShadow = true; return o; };

  // mostrador del pase (frente hacia la cámara, +z)
  const mostrador = sombra(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 0.72), matAcero)); mostrador.position.set(0, -0.02, 0); g.add(mostrador);
  const frente = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.02), matAceroOscuro); frente.position.set(0, -0.49, 0.36); g.add(frente);
  const labio = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.4, 12), matAcero); labio.rotation.z = Math.PI / 2; labio.position.set(0, -0.008, 0.36); g.add(labio);

  // el pinche: base de fundición y aguja de acero
  const matFundicion = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.7, roughness: 0.45 });
  const base = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.012, 48), matFundicion)); base.position.y = 0.006; g.add(base);
  const aro = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.002, 8, 48), matAcero)); aro.rotation.x = Math.PI / 2; aro.position.y = 0.012; g.add(aro);
  const matAguja = new THREE.MeshStandardMaterial({ color: 0xf0f0f2, metalness: 1, roughness: 0.22, envMapIntensity: 2.5 });
  const aguja = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0019, 0.15, 16), matAguja)); aguja.position.y = 0.012 + 0.075; g.add(aguja);
  const punta = sombra(new THREE.Mesh(new THREE.ConeGeometry(0.0011, 0.008, 16), matAguja)); punta.position.y = 0.012 + 0.15 + 0.004; g.add(punta);

  // platos esperando bajo la lámpara (fuera de foco)
  const matLoza = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.25 });
  const plato = () => { const p = new THREE.Group(); const pts = [[0, 0], [0.1, 0], [0.12, 0.012], [0.135, 0.022], [0.13, 0.024], [0.105, 0.014], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)); p.add(sombra(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), matLoza))); return p; };
  const matComida = new THREE.MeshStandardMaterial({ color: 0xa4642c, roughness: 0.6 });
  const platos = [];
  for (const [x, z] of [[-0.62, -0.06], [0.58, 0.02], [1.15, -0.1]]) {
    const p = plato(); p.position.set(x, 0, z); g.add(p); platos.push(p);
    const c = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), matComida)); c.scale.set(1, 0.35, 0.75); c.position.set(0, 0.014, 0); p.add(c);
  }

  // la lámpara de calor sobre el pase
  const caja = sombra(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.16), matAceroOscuro)); caja.position.set(0.15, 0.66, -0.03); g.add(caja);
  const [lr, lg, lb] = kelvin(2100);
  const matFoco = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(lr, lg, lb), emissiveIntensity: 25 });
  for (const x of [-0.45, 0.15, 0.75]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24), matFoco); f.position.set(x, 0.615, -0.03); g.add(f); }
  for (const x of [-0.25, 0.55]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.4, 8), matAceroOscuro); v.position.set(x, 0.66 + 1.2, -0.03); g.add(v); }

  // luz principal: la lámpara (cálida, dura, con sombra)
  const luz = new THREE.SpotLight(new THREE.Color(...kelvin(2600)), 1.35, 6, 0.85, 0.75, 2);
  luz.position.set(0.12, 0.6, -0.02); luz.target.position.set(0.02, 0, 0.02); luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048); luz.shadow.camera.near = 0.05; luz.shadow.camera.far = 4; luz.shadow.bias = -0.0002; luz.shadow.normalBias = 0.0015; luz.shadow.radius = 4;
  luz.shadow.camera.layers.enable(1);
  g.add(luz, luz.target);
  const luz2 = new THREE.SpotLight(new THREE.Color(...kelvin(2200)), 1.2, 5, 0.8, 0.8, 2); luz2.position.set(-0.5, 0.6, -0.03); luz2.target.position.set(-0.6, 0, 0); g.add(luz2, luz2.target);
  const luz3 = new THREE.SpotLight(new THREE.Color(...kelvin(2200)), 1.2, 5, 0.8, 0.8, 2); luz3.position.set(0.8, 0.6, -0.03); luz3.target.position.set(0.9, 0, 0); g.add(luz3, luz3.target);

  // la cocina del fondo: mesada, pared de azulejos, estante, ollas, campana
  const matAzulejo = new THREE.MeshStandardMaterial({ map: T.azulejos(), roughness: 0.22, metalness: 0, envMapIntensity: 0.25, color: 0x9fa4ab });
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), matAzulejo); pared.position.set(0, 1.1, -2.1); pared.receiveShadow = true; g.add(pared);
  const mesada = sombra(new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.7), matAcero)); mesada.position.set(0, -0.5, -1.7); g.add(mesada);
  const estante = sombra(new THREE.Mesh(new THREE.BoxGeometry(5, 0.025, 0.32), matAcero)); estante.position.set(0, 0.85, -1.92); g.add(estante);
  const matOlla = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.28 });
  for (let i = 0; i < 9; i++) {
    const rad = 0.09 + r() * 0.1, alto = 0.1 + r() * 0.2, x = -2.2 + i * 0.52 + r() * 0.1;
    const o = sombra(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.97, alto, 32, 1, true), matOlla)); o.position.set(x, 0.86 + alto / 2, -1.9); g.add(o);
  }
  for (let i = 0; i < 4; i++) { const o = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 32), matOlla)); o.position.set(-1.4 + i * 0.95, 0.11, -1.65); g.add(o); }
  const campana = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 0.9), matAceroOscuro); campana.position.set(0, 2.1, -1.65); g.add(campana);

  // hornallas: anillos de llama azul (puntos de luz fríos en el fondo)
  const matLlama = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.45, 2.6) });
  for (const x of [-1.85, -0.9, 0.95, 1.9]) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 24), matLlama); a.rotation.x = Math.PI / 2; a.position.set(x, 0.0, -1.5); g.add(a); }

  // barra de comandas colgadas (contraluz de la lámpara)
  const barra = sombra(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.02), matAcero)); barra.position.set(0, 0.5, -0.24); g.add(barra);

  // bombitas del fondo (bokeh)
  const bulbos = [];
  for (let i = 0; i < 30; i++) {
    const k = r() < 0.72 ? kelvin(2200 + r() * 1100) : kelvin(4800 + r() * 1800);
    const k2 = r() < 0.08 ? [1, 0.12, 0.05] : k; const m = new THREE.Mesh(new THREE.SphereGeometry(0.006 + Math.pow(r(), 2) * 0.04, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...k2).multiplyScalar(1.2 + r() * 6) }));
    m.position.set(-3.2 + r() * 6.4, 0.15 + r() * 2.0, -2.05 + r() * 1.1); g.add(m); bulbos.push(m);
  }
  const fluo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(...kelvin(5600)).multiplyScalar(9) })); fluo.position.set(-0.9, 1.75, -2.0); g.add(fluo);
  const luzFondo = new THREE.PointLight(new THREE.Color(...kelvin(6000)), 0.9, 6, 2); luzFondo.position.set(-0.9, 1.6, -1.6); g.add(luzFondo);
  const relleno = new THREE.HemisphereLight(0x2a3a58, 0x140c08, 0.08); g.add(relleno);
  // contraluz fría desde la cocina: filo en la aguja y en los bordes del papel
  const contra = new THREE.SpotLight(new THREE.Color(...kelvin(7000)), 3.2, 4, 0.35, 0.9, 2); contra.position.set(-0.55, 0.32, -1.1); contra.target.position.set(0, 0.08, 0); g.add(contra, contra.target);

  // cielorraso: vigas de madera, revoque oscuro y el agujero por donde sale la pila
  const matTecho = new THREE.MeshStandardMaterial({ map: T.revoque('#4a4038', 8), roughness: 0.9 });
  const forma = new THREE.Shape(); forma.moveTo(-4.33, -12.15); forma.lineTo(4.33, -12.15); forma.lineTo(4.33, 6); forma.lineTo(-4.33, 6); forma.closePath();
  const hueco = new THREE.Path(); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, rr = 0.2 + (r() - .5) * 0.06; i ? hueco.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : hueco.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  forma.holes.push(hueco);
  const losaGeo = new THREE.ExtrudeGeometry(forma, { depth: LOSA, bevelEnabled: false, curveSegments: 4 }); losaGeo.rotateX(-Math.PI / 2);
  const losa = new THREE.Mesh(losaGeo, [matTecho, new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 1, side: THREE.DoubleSide })]); losa.position.y = TECHO; losa.receiveShadow = true; g.add(losa);
  const matViga = new THREE.MeshStandardMaterial({ map: T.madera(), roughness: 0.7 });
  for (let i = -5; i <= 5; i++) { if (Math.abs(i * 0.7 + 0.35) < 0.3) continue; if (Math.abs(i * 0.7 + 0.35) > 4.2) continue; const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 18), matViga); v.position.set(i * 0.7 + 0.35, TECHO - 0.11, 3); g.add(v); }

  // lámparas de globo colgando (una pasa cerca de la cámara cuando sube)
  const matGlobo = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(...kelvin(2500)), emissiveIntensity: 5 });
  const colgantes = [[0.62, 2.2, 0.75], [-1.1, 2.25, 1.3], [1.7, 2.3, -0.5], [-0.5, 2.35, 2.4], [-1.9, 2.2, -0.2]];
  for (const [x, y, z] of colgantes) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), matGlobo); b.position.set(x, y, z); g.add(b);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, TECHO - y, 6), matFundicion); cable.position.set(x, (TECHO + y) / 2, z); g.add(cable);
    const pl = new THREE.PointLight(new THREE.Color(...kelvin(2500)), 0.6, 5, 2); pl.position.set(x, y - 0.05, z); g.add(pl);
  }

  // vapor de una olla del fondo y polvo en la luz de la lámpara
  const texHumo = T.humo();
  const vapor = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: texHumo, transparent: true, depthWrite: false, color: new THREE.Color(...kelvin(2600)).multiplyScalar(0.9), opacity: 0.0 }));
    g.add(s); vapor.push({ s, f: r(), x: -0.75 + r() * 0.5, rot: r() * 6 });
  }
  const NP = 420, pos = new Float32Array(NP * 3), sem = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pos[i * 3] = (r() - .5) * 1.0; pos[i * 3 + 1] = r() * 0.6; pos[i * 3 + 2] = (r() - .5) * 0.8; sem[i] = r(); }
  const geoP = new THREE.BufferGeometry(); geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geoP.setAttribute('aSem', new THREE.BufferAttribute(sem, 1));
  const matP = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uLuz: { value: new THREE.Vector3(0.12, 0.6, -0.02) }, uCol: { value: new THREE.Color(...kelvin(2400)) }, uPx: { value: 720 } },
    vertexShader: `attribute float aSem; uniform float uT, uPx; uniform vec3 uLuz; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + uT * (.006 + aSem * .01), .6); p.x += sin(uT * .3 + aSem * 40.) * .03; p.z += cos(uT * .23 + aSem * 17.) * .03;
        vec3 d = p - uLuz; float cono = smoothstep(.55, .9, dot(normalize(d), vec3(0., -1., 0.)));
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (.0011 + aSem * .0012) / -mv.z;
        vA = cono * (.25 + .75 * fract(aSem * 13.7)); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d) * vA; gl_FragColor = vec4(uCol * a * 2.5, 0.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const polvo = new THREE.Points(geoP, matP); g.add(polvo);

  // cocineros de espaldas que cruzan el fondo (siempre fuera de foco)
  const matChaqueta = new THREE.MeshStandardMaterial({ color: 0xa9a49c, roughness: 0.85 }), matPelo = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.9 });
  const cocineros = [[1.3, 4.6, -1.0, 1.6], [5.0, 7.8, 1.0, -1.7], [0.0, 2.4, 2.2, 0.6]].map(([t0, t1, x0, x1]) => {
    const c = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 6, 16), matChaqueta); torso.scale.set(1, 1, 0.62); torso.position.y = 0.55; c.add(torso);
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), matPelo); cabeza.position.y = 1.08; c.add(cabeza);
    const gorro = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), matChaqueta); gorro.position.y = 1.17; c.add(gorro);
    c.position.set(x0, PISO + 0.6, -1.38); g.add(c); return { c, t0, t1, x0, x1 };
  });

  return {
    grupo: g, luz, polvo, matP, platos,
    poner(t, H) {
      matP.uniforms.uT.value = t; matP.uniforms.uPx.value = H;
      for (const k of cocineros) { const u = (t - k.t0) / (k.t1 - k.t0); k.c.visible = u > 0 && u < 1; k.c.position.x = k.x0 + (k.x1 - k.x0) * u; k.c.position.y = PISO + 0.6 + Math.abs(Math.sin(u * 14)) * 0.02; k.c.rotation.z = Math.sin(u * 14) * 0.02; }
      for (const v of vapor) {
        const f = (t * 0.22 + v.f) % 1, y = 0.25 + f * 1.3;
        v.s.position.set(v.x + Math.sin(t * 0.4 + v.rot) * 0.06 * f, y - 0.15, -1.05);
        v.s.scale.setScalar(0.5 + f * 1.4); v.s.material.opacity = Math.sin(Math.PI * f) * 0.85; v.s.rotation.z = v.rot + t * 0.15;
      }
    },
  };
}

// La azotea: baldosas, parapeto, tanque de agua, antena, medianeras de los vecinos con ventanas.
export function crearAzotea(escena) {
  const g = new THREE.Group(); escena.add(g);
  const r = rng(202);
  const y0 = TECHO + LOSA;
  const matBaldosa = new THREE.MeshStandardMaterial({ map: T.baldosas(), roughness: 0.85 });
  // el piso de la azotea ya es la cara de arriba de la losa: se le pone baldosa con un plano apenas por encima, con su propio agujero
  const forma = new THREE.Shape(); forma.moveTo(-4.33, -12); forma.lineTo(4.33, -12); forma.lineTo(4.33, 18); forma.lineTo(-4.33, 18); forma.closePath();
  const hueco = new THREE.Path(); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, rr = 0.22 + (r() - .5) * 0.08; i ? hueco.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : hueco.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } forma.holes.push(hueco);
  const piso = new THREE.Mesh(new THREE.ShapeGeometry(forma, 6), matBaldosa); piso.rotation.x = -Math.PI / 2; piso.position.y = y0 + 0.003; piso.receiveShadow = true; g.add(piso);
  // escombro alrededor del agujero
  const matEscombro = new THREE.MeshStandardMaterial({ color: 0x6b4536, roughness: 0.9 });
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = 0.25 + r() * 0.5, s = 0.02 + r() * 0.06; const e = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s * 0.8), matEscombro); e.position.set(Math.cos(a) * d, y0 + s * 0.2, Math.sin(a) * d); e.rotation.set(r(), r() * 3, r()); g.add(e); }
  const matPared = new THREE.MeshStandardMaterial({ map: T.revoque('#8a8178', 12), roughness: 0.95 });
  // parapetos
  for (const [x, z, w, d] of [[-4.33, -3, 0.15, 30], [4.33, -3, 0.15, 30], [0, 12, 8.8, 0.15], [0, -18, 8.8, 0.15]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), matPared); p.position.set(x, y0 + 0.5, z); g.add(p); }
  // tanque de agua sobre su base
  const matTanque = new THREE.MeshStandardMaterial({ color: 0x8d9094, roughness: 0.7 });
  const tanque = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.3, 40), matTanque); tanque.position.set(-2.9, y0 + 1.25 + 0.65, -5.5); g.add(tanque);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.06, 40), matTanque); tapa.position.set(-2.9, y0 + 2.6, -5.5); g.add(tapa);
  for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, 0.06), matTanque); p.position.set(-2.9 + dx, y0 + 0.62, -5.5 + dz); g.add(p); }
  // antena
  const matFierro = new THREE.MeshStandardMaterial({ color: 0x2c2e31, metalness: 0.8, roughness: 0.5 });
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4, 8), matFierro); mastil.position.set(2.8, y0 + 2, -7); g.add(mastil);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2 - i * 0.15, 6), matFierro); b.rotation.z = Math.PI / 2; b.position.set(2.8, y0 + 3.2 + i * 0.18, -7); g.add(b); }
  // medianera alta a la izquierda y edificio de atrás con ventanas
  const medianera = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 24), new THREE.MeshStandardMaterial({ map: T.revoque('#5e5a55', 19), roughness: 1 })); medianera.position.set(-4.6, y0 + 4.5, -3); g.add(medianera);
  return { grupo: g };
}
