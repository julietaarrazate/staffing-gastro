// El salón del bodegón, la fachada y la calle: mesas con sifones, sombras de comensales, el delantal colgado,
// el celular sobre el pase, la puerta abierta, el cartel, la vereda de baldosas y los adoquines.
import * as THREE from 'three';
import { rng, kelvin, smooth, rebote } from './util.js';
import * as T from './texturas.js';
import { PISO, TECHO, LOSA } from './cocina.js';

export const FACHADA = 12; // z de la fachada
const ANCHO = 4.33;

export function crearSalon(escena, guion) {
  const g = new THREE.Group(); escena.add(g);
  const r = rng(404);
  const sombra = o => { o.castShadow = true; o.receiveShadow = true; return o; };
  const madera = T.madera();
  const matMadera = new THREE.MeshStandardMaterial({ map: madera, roughness: 0.55, color: 0x8a6a50 });
  const matMaderaOsc = new THREE.MeshStandardMaterial({ map: madera, roughness: 0.6, color: 0x5a3c28 });
  const matRevoque = new THREE.MeshStandardMaterial({ map: T.revoque('#cbbd9f', 31), roughness: 0.92 });
  const matFachada = new THREE.MeshStandardMaterial({ map: T.revoque('#b8ad99', 32), roughness: 0.95 });

  // piso calcáreo
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO * 2, FACHADA + 0.4), new THREE.MeshStandardMaterial({ map: T.calcareo(), roughness: 0.32, envMapIntensity: 0.7 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(0, PISO, FACHADA / 2 - 0.2); piso.receiveShadow = true; g.add(piso);
  // paredes laterales: zócalo de madera y revoque
  for (const sx of [-1, 1]) {
    const z0 = 0.4, L = FACHADA - z0;
    const zoc = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, L), matMaderaOsc); zoc.position.set(sx * (ANCHO - 0.03), PISO + 0.575, z0 + L / 2); zoc.receiveShadow = true; g.add(zoc);
    const par = new THREE.Mesh(new THREE.PlaneGeometry(L, TECHO - PISO), matRevoque); par.rotation.y = -sx * Math.PI / 2; par.position.set(sx * (ANCHO - 0.001), (TECHO + PISO) / 2, z0 + L / 2); par.receiveShadow = true; g.add(par);
    // cuadros (rectángulos cálidos)
    for (let k = 0; k < 3; k++) { const cu = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55 + r() * 0.3, 0.8 + r() * 0.4), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.07 + r() * 0.05, 0.4, 0.18 + r() * 0.1), roughness: 0.5 })); cu.position.set(sx * (ANCHO - 0.03), 1.5 + r() * 0.3, 3 + k * 3); g.add(cu); }
  }
  // estantería de botellas a la derecha
  const matVidrioVerde = new THREE.MeshStandardMaterial({ color: 0x0e2a16, roughness: 0.08, metalness: 0.2, envMapIntensity: 2.2 });
  const botella = (() => { const pts = [[0, 0], [0.038, 0], [0.04, 0.005], [0.04, 0.2], [0.03, 0.24], [0.013, 0.27], [0.013, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 20); })();
  const nBot = 60, bots = new THREE.InstancedMesh(botella, matVidrioVerde, nBot); const m4 = new THREE.Matrix4();
  for (let i = 0; i < nBot; i++) { const fila = Math.floor(i / 20), k = i % 20; m4.makeTranslation(ANCHO - 0.18, 0.35 + fila * 0.55, 1.2 + k * 0.11 + (fila % 2) * 0.05); bots.setMatrixAt(i, m4); }
  g.add(bots);
  for (let f = 0; f < 3; f++) { const est = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 2.5), matMaderaOsc); est.position.set(ANCHO - 0.17, 0.33 + f * 0.55, 2.25); g.add(est); }

  // mesas con mantel, platos, vasos, sifones, vino, pan
  const matMantel = new THREE.MeshStandardMaterial({ color: 0xefe9dd, roughness: 0.85 });
  const matLoza = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.22 });
  const matVaso = new THREE.MeshStandardMaterial({ color: 0xd8e4e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 2.5 });
  const matVino = new THREE.MeshStandardMaterial({ color: 0x3a0610, roughness: 0.2, transparent: true, opacity: 0.85 });
  const matSifon = new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.8, envMapIntensity: 2.4 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0xc9c9cc, metalness: 1, roughness: 0.25 });
  const matComida = new THREE.MeshStandardMaterial({ color: 0xb06a2a, roughness: 0.6 });
  const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const gPlato = lathe([[0, 0], [0.1, 0], [0.12, 0.012], [0.135, 0.022], [0.13, 0.024], [0.105, 0.014], [0, 0.012]]);
  const gVaso = lathe([[0, 0], [0.032, 0], [0.036, 0.11], [0.034, 0.11], [0.03, 0.005], [0, 0.005]]);
  const gSifon = lathe([[0, 0], [0.05, 0], [0.052, 0.02], [0.052, 0.24], [0.03, 0.27], [0, 0.27]]);
  const mesas = [], cuerpos = [];
  const lugares = [[-2.3, 3.1], [2.1, 3.3], [-2.3, 5.7], [2.1, 5.9], [-2.3, 8.3], [2.1, 8.5], [-2.2, 10.7], [2.0, 10.8]];
  for (const [mx, mz] of lugares) {
    const m = new THREE.Group(); m.position.set(mx, PISO, mz); g.add(m); mesas.push(m);
    const tapa = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.85), matMadera)); tapa.position.y = 0.75; m.add(tapa);
    const mantel = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.9), matMantel)); mantel.position.y = 0.776; m.add(mantel);
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.74, 10), matMaderaOsc); pata.position.y = 0.37; m.add(pata);
    for (const [px, pz] of [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2]]) {
      const pl = sombra(new THREE.Mesh(gPlato, matLoza)); pl.position.set(px * 0.95, 0.783, pz * 0.95); m.add(pl);
      if (r() < 0.75) { const co = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matComida)); co.scale.set(1.2, 0.35, 0.8); co.position.set(px * 0.95, 0.795, pz * 0.95); m.add(co); }
      const va = sombra(new THREE.Mesh(gVaso, matVaso)); va.position.set(px * 0.95 + 0.12, 0.783, pz * 0.95 - 0.08); m.add(va);
      if (r() < 0.6) { const vi = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.06, 16), matVino); vi.position.set(px * 0.95 + 0.12, 0.818, pz * 0.95 - 0.08); m.add(vi); }
    }
    const si = sombra(new THREE.Mesh(gSifon, matSifon)); si.position.set(0.04, 0.783, -0.02); m.add(si);
    const cab = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 12), matMetal)); cab.position.set(0.04, 0.783 + 0.3, -0.02); m.add(cab);
    const bo = sombra(new THREE.Mesh(botella, matVidrioVerde)); bo.position.set(-0.08, 0.783, 0.06); m.add(bo);
    // sillas
    for (const [cx, cz, ry] of [[0, -0.62, 0], [0, 0.62, Math.PI], [-0.62, 0, Math.PI / 2], [0.62, 0, -Math.PI / 2]]) {
      const si2 = new THREE.Group(); si2.position.set(cx, 0, cz); si2.rotation.y = ry; m.add(si2);
      const asiento = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), matMaderaOsc)); asiento.position.y = 0.46; si2.add(asiento);
      const resp = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), matMaderaOsc)); resp.position.set(0, 0.62, -0.16); si2.add(resp);
      for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { const le = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), matMaderaOsc); le.position.set(lx, 0.23, lz); si2.add(le); }
      // comensal: sólo su sombra (cabeza, hombros y un brazo sobre la mesa)
      if (r() < 0.8) {
        const cuerpo = new THREE.Group(); cuerpo.position.set(0, 0.46, -0.02); si2.add(cuerpo);
        const invisible = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 10), invisible); torso.scale.set(1, 1, 0.6); torso.position.y = 0.36; cuerpo.add(torso);
        const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), invisible); cabeza.position.set(0, 0.8, 0.02); cuerpo.add(cabeza);
        const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 4, 8), invisible); brazo.rotation.x = Math.PI / 2 - 0.3; brazo.position.set(0.14, 0.38, 0.22); cuerpo.add(brazo);
        for (const o of [torso, cabeza, brazo]) { o.castShadow = true; o.frustumCulled = false; }
        cuerpos.push({ cuerpo, f: r() * 6, brazo });
      }
    }
  }
  // luces del salón: globos y dos focos con sombra (las sombras de la gente sobre los manteles)
  const matGlobo = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(...kelvin(2500)), emissiveIntensity: 5 });
  for (const [mx, mz] of lugares) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 12), matGlobo); b.position.set(mx, 2.15, mz); g.add(b); const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, TECHO - 2.15, 6), matMetal); cab.position.set(mx, (TECHO + 2.15) / 2, mz); g.add(cab); }
  const focos = [];
  for (const [mx, mz] of [[-2.3, 5.7], [2.1, 8.5]]) {
    const f = new THREE.SpotLight(new THREE.Color(...kelvin(2500)), 3.2, 9, 1.05, 0.9, 2); f.position.set(mx, 2.05, mz); f.target.position.set(mx, PISO, mz + 0.3);
    f.castShadow = true; f.shadow.mapSize.set(1024, 1024); f.shadow.camera.near = 0.1; f.shadow.camera.far = 6; f.shadow.radius = 5; f.shadow.bias = -0.0005; g.add(f, f.target); focos.push(f);
  }
  for (const [mx, mz] of [[2.1, 3.3], [-2.3, 8.3], [0, 10.6]]) { const pl = new THREE.PointLight(new THREE.Color(...kelvin(2500)), 1.6, 7, 2); pl.position.set(mx, 2.0, mz); g.add(pl); }

  // el delantal colgado, sin dueño
  const delantal = (() => {
    const geo = new THREE.PlaneGeometry(0.5, 0.78, 14, 20), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), u = (0.39 - y) / 0.78; pos.setZ(i, Math.sin(x * 22 + 1) * 0.018 * u + Math.sin(x * 9) * 0.01 + u * u * 0.03); pos.setX(i, x * (0.62 + 0.38 * Math.min(1, u * 2.2))); }
    geo.computeVertexNormals();
    const c = document.createElement('canvas'); c.width = 256; c.height = 384; const k = c.getContext('2d');
    k.fillStyle = '#20252b'; k.fillRect(0, 0, 256, 384); for (let i = 0; i < 3000; i++) { k.fillStyle = `rgba(255,255,255,${Math.random() * .035})`; k.fillRect(Math.random() * 256, Math.random() * 384, 1, 2); }
    k.strokeStyle = 'rgba(230,225,215,.5)'; k.lineWidth = 3; k.strokeRect(40, 200, 176, 90); // bolsillo
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const m = sombra(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, side: THREE.DoubleSide })));
    m.position.set(-2.0, 0.78, 0.46); g.add(m);
    const tira = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9 })); tira.position.set(-2.0, 1.17, 0.46); g.add(tira);
    const gancho = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), matMetal); gancho.rotation.x = Math.PI / 2; gancho.position.set(-2.0, 1.28, 0.43); g.add(gancho);
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.2, TECHO - PISO, 0.2), matRevoque); poste.position.set(-2.0, (TECHO + PISO) / 2, 0.3); g.add(poste);
    return m;
  })();

  // el celular sobre el pase
  const tel = crearCelular(guion);
  tel.grupo.position.set(-0.46, 0.004, 0.17); tel.grupo.rotation.y = 0.35; g.add(tel.grupo);

  // la fachada: pared con puerta y dos ventanas
  const forma = new THREE.Shape(); forma.moveTo(-ANCHO, PISO); forma.lineTo(ANCHO, PISO); forma.lineTo(ANCHO, TECHO + LOSA + 1); forma.lineTo(-ANCHO, TECHO + LOSA + 1); forma.closePath();
  const hueco = (x0, y0, x1, y1) => { const h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x1, y0); h.lineTo(x1, y1); h.lineTo(x0, y1); h.closePath(); forma.holes.push(h); };
  hueco(-0.85, PISO, 0.85, 1.95); hueco(-3.4, 0.05, -1.7, 2.15); hueco(1.7, 0.05, 3.4, 2.15);
  const fGeo = new THREE.ExtrudeGeometry(forma, { depth: 0.32, bevelEnabled: false });
  const fachada = new THREE.Mesh(fGeo, matFachada); fachada.position.z = FACHADA - 0.16; fachada.receiveShadow = true; fachada.castShadow = true; g.add(fachada);
  // cornisa y molduras
  for (const [y, h, d] of [[2.45, 0.12, 0.12], [TECHO + LOSA + 0.1, 0.2, 0.2], [TECHO + LOSA + 1, 0.1, 0.18]]) { const mo = new THREE.Mesh(new THREE.BoxGeometry(ANCHO * 2 + 0.1, h, d), matFachada); mo.position.set(0, y, FACHADA + 0.16 + d / 2); mo.castShadow = true; g.add(mo); }
  // puertas abiertas hacia adentro y marcos de ventana
  for (const s of [-1, 1]) {
    const hoja = new THREE.Group(); hoja.position.set(s * 0.85, PISO, FACHADA - 0.1); g.add(hoja);
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.88, 0.05), matMaderaOsc); tabla.position.set(-s * 0.425, 1.44, 0); hoja.add(tabla);
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.3), new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.05, metalness: 0.4, envMapIntensity: 2 })); vidrio.position.set(-s * 0.425, 1.9, 0.03); hoja.add(vidrio);
    hoja.rotation.y = s * -1.25;
  }
  for (const x of [-2.55, 2.55]) {
    const marco = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6, transparent: true, opacity: 1 }));
    const mg = new THREE.Group(); mg.position.set(x, 1.1, FACHADA + 0.06); g.add(mg);
    for (const [w, h, px, py] of [[1.7, 0.06, 0, 1.02], [1.7, 0.06, 0, -1.02], [0.06, 2.1, -0.82, 0], [0.06, 2.1, 0.82, 0], [0.04, 2.1, 0, 0], [1.7, 0.04, 0, 0.35]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), marco.material); b.position.set(px, py, 0); mg.add(b); }
  }
  // el cartel, con su lamparita
  const matCartel = new THREE.MeshStandardMaterial({ map: T.cartel(guion.cartel || ''), roughness: 0.6, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0, emissiveMap: null });
  const cartel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.82, 0.06), [matFachada, matFachada, matFachada, matFachada, matCartel, matFachada]); cartel.position.set(0, 2.95, FACHADA + 0.2); g.add(cartel);
  const luzCartel = new THREE.SpotLight(new THREE.Color(...kelvin(2700)), 0, 4, 0.9, 0.6, 2); luzCartel.position.set(0, 3.6, FACHADA + 0.9); luzCartel.target.position.set(0, 2.9, FACHADA + 0.2); g.add(luzCartel, luzCartel.target);
  // apliques a los lados de la puerta
  const matAplique = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(...kelvin(2400)), emissiveIntensity: 0 });
  for (const x of [-1.25, 1.25]) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), matAplique); a.position.set(x, 1.75, FACHADA + 0.3); g.add(a); }
  const luzPuerta = new THREE.PointLight(new THREE.Color(...kelvin(2500)), 0, 7, 2); luzPuerta.position.set(0, 1.6, FACHADA + 0.7); g.add(luzPuerta);

  // la calle: veredas de baldosas, cordón, adoquines, faroles
  const largo = 320, texV = T.vereda(); texV.repeat.set(largo / 0.4, 3 / 0.4);
  const matVereda = new THREE.MeshStandardMaterial({ map: texV, roughness: 0.85 });
  for (const [z0, z1] of [[FACHADA, FACHADA + 3], [FACHADA + 10.4, FACHADA + 13.4]]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.15, z1 - z0), [matVereda, matVereda, matVereda, matVereda, matVereda, matVereda]); v.position.set(0, PISO + 0.075, (z0 + z1) / 2); v.receiveShadow = true; g.add(v);
  }
  const texA = T.adoquines(); texA.repeat.set(largo / 8, 1);
  const calle = new THREE.Mesh(new THREE.PlaneGeometry(largo, 7.4), new THREE.MeshStandardMaterial({ map: texA, roughness: 0.55, envMapIntensity: 0.9 })); calle.rotation.x = -Math.PI / 2; calle.position.set(0, PISO + 0.002, FACHADA + 6.7); calle.receiveShadow = true; g.add(calle);
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.6, roughness: 0.5 });
  const matFarol = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(...kelvin(3200)), emissiveIntensity: 0 });
  const faroles = [];
  for (let x = -150; x <= 150; x += 25) for (const z of [FACHADA + 2.6, FACHADA + 10.8]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 8), matPoste); p.position.set(x + (z > 20 ? 12 : 0), PISO + 2.6, z); g.add(p);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), matFarol); l.position.set(x + (z > 20 ? 12 : 0), PISO + 5.3, z); g.add(l); faroles.push(l.position.clone());
  }
  const lucesCalle = [];
  for (const [x, z] of [[0, FACHADA + 2.6], [12, FACHADA + 10.8], [-25, FACHADA + 2.6]]) { const pl = new THREE.PointLight(new THREE.Color(...kelvin(3200)), 0, 22, 2); pl.position.set(x, PISO + 5.0, z); g.add(pl); lucesCalle.push(pl); }

  return {
    grupo: g, tel, delantal, faroles, focos, lucesCalle,
    // luces: «se prenden» (0 a 1) adentro y en la calle
    poner(t, { adentro = 1, calle = 1 } = {}) {
      matCartel.emissiveIntensity = 0; luzCartel.intensity = 6 * adentro; matAplique.emissiveIntensity = 10 * adentro; luzPuerta.intensity = 3 * adentro;
      matGlobo.emissiveIntensity = 5 * adentro; for (const f of focos) f.intensity = 3.2 * adentro;
      matFarol.emissiveIntensity = 14 * calle; for (const l of lucesCalle) l.intensity = 9 * calle;
      for (const c of cuerpos) { c.cuerpo.rotation.y = Math.sin(t * 0.8 + c.f) * 0.15; c.cuerpo.position.z = -0.02 + Math.sin(t * 0.6 + c.f * 2) * 0.03; c.brazo.rotation.z = Math.sin(t * 1.3 + c.f) * 0.2; }
      tel.poner(t);
    },
  };
}

// Un celular: pantalla dibujada en un lienzo (bloqueo con aviso, llamada entrante, aviso de turno) y vibración.
export function crearCelular(guion) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.008, 0.152), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.35, metalness: 0.5 }));
  cuerpo.position.y = 0.004; cuerpo.castShadow = true; g.add(cuerpo);
  const c = document.createElement('canvas'); c.width = 432; c.height = 912; const k = c.getContext('2d');
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const matPant = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0, roughness: 0.08, metalness: 0.3, envMapIntensity: 1.4 });
  const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.14), matPant); pant.rotation.x = -Math.PI / 2; pant.position.y = 0.0082; g.add(pant);
  const T0 = guion.telefono || {};
  let modo = null;
  const dibujar = (m, extra = 0) => {
    if (m === modo && m !== 'llamada') return; modo = m;
    k.fillStyle = '#05070c'; k.fillRect(0, 0, 432, 912);
    if (m === 'apagado') { tx.needsUpdate = true; return; }
    const fondo = k.createLinearGradient(0, 0, 0, 912); fondo.addColorStop(0, '#0c1a33'); fondo.addColorStop(1, '#152a4a'); k.fillStyle = fondo; k.fillRect(0, 0, 432, 912);
    k.fillStyle = '#e9eef6'; k.textAlign = 'center';
    if (m === 'mensaje') {
      k.font = '300 120px "Inter", Arial, sans-serif'; k.fillText('19:02', 216, 230); k.font = '500 26px "Inter", Arial, sans-serif'; k.fillText('viernes', 216, 280);
      k.fillStyle = 'rgba(235,240,248,.94)'; k.beginPath(); k.roundRect(18, 340, 396, 200, 28); k.fill();
      k.fillStyle = '#121722'; k.textAlign = 'left'; k.font = '600 34px "Inter", Arial, sans-serif'; k.fillText(T0.remitente || '', 44, 400);
      k.font = '500 44px "Inter", Arial, sans-serif'; k.fillText(T0.mensaje || '', 44, 478);
      k.fillStyle = '#6b7484'; k.font = '400 24px "Inter", Arial, sans-serif'; k.textAlign = 'right'; k.fillText('ahora', 392, 400);
    } else if (m === 'llamada') {
      k.font = '400 30px "Inter", Arial, sans-serif'; k.fillStyle = '#9fb0c8'; k.fillText('llamada entrante', 216, 250);
      k.font = '500 62px "Inter", Arial, sans-serif'; k.fillStyle = '#eef3fa'; k.fillText(T0.llamada || '', 216, 330);
      const pulso = 1 + 0.12 * Math.sin(extra * 8);
      for (const [x, col] of [[110, '#c0392b'], [322, '#2e9e5b']]) { k.fillStyle = col; k.beginPath(); k.arc(x, 760, 52 * (col === '#2e9e5b' ? pulso : 1), 0, Math.PI * 2); k.fill(); }
    } else if (m === 'aviso') {
      k.font = '300 120px "Inter", Arial, sans-serif'; k.fillText('19:41', 216, 230);
      k.fillStyle = 'rgba(235,240,248,.94)'; k.beginPath(); k.roundRect(24, 330, 384, 170, 26); k.fill();
      k.fillStyle = '#163f5c'; k.beginPath(); k.roundRect(48, 356, 44, 44, 10); k.fill(); k.fillStyle = '#f2ead8'; k.fillRect(68, 364, 4, 30); k.beginPath(); k.ellipse(70, 394, 14, 4, 0, 0, Math.PI * 2); k.fill();
      k.fillStyle = '#121722'; k.textAlign = 'left'; k.font = '600 26px "Inter", Arial, sans-serif'; k.fillText(T0.aviso_titulo || '', 108, 388);
      k.font = '500 29px "Inter", Arial, sans-serif'; k.fillText(T0.aviso || '', 52, 458);
      k.fillStyle = '#6b7484'; k.font = '400 20px "Inter", Arial, sans-serif'; k.textAlign = 'right'; k.fillText('ahora', 384, 388);
    }
    tx.needsUpdate = true;
  };
  dibujar('apagado');
  const vibras = [];
  return {
    grupo: g, pantalla: matPant,
    // estados: [[t0, t1, modo, brillo]], vibraciones: tiempos
    estados: [], vibras,
    poner(t) {
      let m = 'apagado', b = 0, desde = 0;
      for (const [t0, t1, mm, bb] of this.estados) if (t >= t0 && t < t1) { m = mm; desde = t0; b = bb * smooth(t0, t0 + 0.08, t) * (1 - smooth(t1 - 0.12, t1, t)); }
      dibujar(m, t - desde); matPant.emissiveIntensity = b;
      let dx = 0, dz = 0, ry = 0;
      for (const v of vibras) { const u = t - v; if (u > 0 && u < 0.55) { const a = Math.sin(u * 160) * 0.0012 * (u < 0.5 ? 1 : 0); dx += a; dz += a * 0.6; ry += a * 6; } }
      cuerpo.position.x = dx; cuerpo.position.z = dz; pant.position.x = dx; pant.position.z = dz; g.rotation.z = 0; cuerpo.rotation.y = ry; pant.rotation.z = ry;
    },
  };
}
