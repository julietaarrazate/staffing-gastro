// El personal del bodegón (versión 2), en siluetas a contraluz que se mueven: los mozos con delantal largo y bandeja,
// el barman, la cajera, el cocinero de espaldas con la sartén y el fuego, y mesas que llaman con la mano.
// Cada figura es un lienzo que se redibuja en cada cuadro con su pose (caminar, servir, sacudir la sartén, saludar).
import * as THREE from 'three';
import { rng, kelvin, lerp, sat, smooth } from './util.js';
import { PISO } from './cocina.js';

// ---------- la figura: un esqueleto simple dibujado con trazos redondos (unidades: 1000 = alto de una persona) ----------
// capa 'mascara': la silueta entera; capa 'claro': sólo lo claro (el delantal del mozo, la chaqueta y el gorro del cocinero)
function figura(g, p, capa) {
  const M = capa === 'mascara';
  g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = g.strokeStyle = M ? '#fff' : (p.claro || '#d8d0c0');
  const pt = (x, y) => [x, -y];
  const linea = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(...pt(...pts[0])); for (const q of pts.slice(1)) g.lineTo(...pt(...q)); g.stroke(); };
  const desde = (o, ang, l) => [o[0] + Math.sin(ang) * l, o[1] - Math.cos(ang) * l];
  const sent = !!p.sentada, cad = sent ? 330 : 480, hom = cad + 290;
  const torso = () => { g.beginPath(); g.moveTo(...pt(-118, hom)); g.bezierCurveTo(...pt(-132, hom - 120), ...pt(-112, cad + 60), ...pt(-92, cad - 10)); g.lineTo(...pt(92, cad - 10)); g.bezierCurveTo(...pt(112, cad + 60), ...pt(132, hom - 120), ...pt(118, hom)); g.bezierCurveTo(...pt(70, hom + 40), ...pt(-70, hom + 40), ...pt(-118, hom)); g.fill(); };
  const manos = [], brazos = [];
  for (const s of [-1, 1]) { const [aH, aC] = (s < 0 ? p.brazoI : p.brazoD) || [s * 0.12, 0]; const h = [s * 112, hom - 20], c = desde(h, aH, 260), m = desde(c, aH + aC, 240); manos.push(m); brazos.push([h, c, m]); }
  const delantal = () => { g.beginPath(); g.moveTo(...pt(-100, cad + 20)); g.lineTo(...pt(100, cad + 20)); g.lineTo(...pt(114, 130)); g.lineTo(...pt(-114, 130)); g.closePath(); g.fill(); };
  const gorro = () => { g.beginPath(); g.ellipse(0, -(hom + 215), 72, 46, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-56, -(hom + 205), 112, 44); };
  if (!M) { if (p.delantal && !sent) delantal(); if (p.chaqueta) { torso(); for (const br of brazos) linea(br, 62); } if (p.gorro) gorro(); return; }
  // piernas
  if (!sent) for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, a1 = p.piernas?.[i] ?? 0, a2 = p.rodillas?.[i] ?? 0, h = [s * 42, cad], k = desde(h, a1, 245), f = desde(k, a1 - a2, 245); linea([h, k, f], 84); }
  torso(); for (const br of brazos) linea(br, 60);
  g.fillRect(-26, -(hom + 70), 52, 72);
  g.beginPath(); g.ellipse(0, -(hom + 140), 60, 74, 0, 0, Math.PI * 2); g.fill();
  if (p.pelo) { g.beginPath(); g.ellipse(-28, -(hom + 122), 30, 60, 0.4, 0, Math.PI * 2); g.fill(); }
  if (p.delantal && !sent) delantal();
  if (p.gorro) gorro();
  if (p.bandeja) { const [x, y] = manos[1]; g.beginPath(); g.ellipse(x, -(y + 18), 170, 22, 0, 0, Math.PI * 2); g.fill(); for (const dx of [-110, -50, 20, 80]) g.fillRect(x + dx, -(y + 92), 34, 74); g.fillRect(x + 120, -(y + 170), 30, 150); g.fillRect(x + 126, -(y + 205), 18, 40); }
  if (p.botella !== undefined) { const [x, y] = manos[1]; g.save(); g.translate(x, -y); g.rotate(p.botella); g.fillRect(-22, -150, 44, 170); g.fillRect(-11, -205, 22, 60); g.restore(); }
  if (p.sarten !== undefined) { const [x, y] = manos[1]; g.save(); g.translate(x, -y); g.rotate(p.sarten); g.fillRect(0, -10, 150, 20); g.beginPath(); g.ellipse(250, 0, 110, 26, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
}

// una silueta animada: máscara y color, redibujados cada cuadro; ropa oscura con un filo de luz cálida de un lado
function silueta(escena, { alto = 1.75, ropa = '#0e0f13' } = {}) {
  const W = 512, H = 512, lienzo = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [cm, gm] = lienzo(), [cc, gc] = lienzo(), [cf, gf] = lienzo();
  const tm = new THREE.CanvasTexture(cm); tm.colorSpace = THREE.NoColorSpace;
  const tc = new THREE.CanvasTexture(cc); tc.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(alto * 1.4, alto * 1.4), new THREE.MeshStandardMaterial({ map: tc, alphaMap: tm, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tc, emissiveIntensity: 0.1 }));
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: tm, alphaTest: 0.4, side: THREE.DoubleSide });
  m.castShadow = true; escena.add(m);
  const esc = H / 1000 / 1.4;
  return {
    m,
    dibujar(p) {
      for (const g of [gm, gc]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); }
      gc.fillStyle = ropa; gc.fillRect(0, 0, W, H);
      for (const [g, capa] of [[gm, 'mascara'], [gc, 'claro']]) { g.save(); g.translate(W / 2, H - 4); g.scale(esc, esc); figura(g, p, capa); g.restore(); }
      // filo de luz: la parte de la silueta que no tapa la misma silueta corrida 7 px, en naranja y desenfocada
      gf.setTransform(1, 0, 0, 1, 0, 0); gf.clearRect(0, 0, W, H); gf.globalCompositeOperation = 'source-over'; gf.drawImage(cm, 0, 0);
      gf.globalCompositeOperation = 'destination-out'; gf.drawImage(cm, 7, 0); gf.globalCompositeOperation = 'source-in'; gf.fillStyle = 'rgb(255,160,80)'; gf.fillRect(0, 0, W, H); gf.globalCompositeOperation = 'source-over';
      gc.save(); gc.filter = 'blur(3px)'; gc.globalAlpha = 0.55; gc.drawImage(cf, 0, 0); gc.restore();
      tm.needsUpdate = tc.needsUpdate = true;
    },
    poner(x, y, z, cam) { m.position.set(x, y + m.geometry.parameters.height / 2 - 0.02, z); m.rotation.y = Math.atan2(cam.x - x, cam.z - z); },
  };
}

// recorrido por puntos [t, x, z]: posición y fase de paso (según la distancia recorrida)
function recorrido(R) {
  const L = [0]; for (let i = 1; i < R.length; i++) L.push(L[i - 1] + Math.hypot(R[i][1] - R[i - 1][1], R[i][2] - R[i - 1][2]));
  return t => {
    if (t <= R[0][0]) return { x: R[0][1], z: R[0][2], d: 0, v: 0 };
    if (t >= R[R.length - 1][0]) { const e = R[R.length - 1]; return { x: e[1], z: e[2], d: L[L.length - 1], v: 0 }; }
    let k = 0; while (t > R[k + 1][0]) k++;
    const u = (t - R[k][0]) / (R[k + 1][0] - R[k][0]), seg = L[k + 1] - L[k];
    return { x: R[k][1] + (R[k + 1][1] - R[k][1]) * u, z: R[k][2] + (R[k + 1][2] - R[k][2]) * u, d: L[k] + seg * u, v: seg / (R[k + 1][0] - R[k][0]) };
  };
}
const caminar = (fase, amp) => ({ piernas: [Math.sin(fase) * 0.42 * amp, -Math.sin(fase) * 0.42 * amp], rodillas: [Math.max(0, Math.sin(fase + 1.6)) * 0.6 * amp, Math.max(0, -Math.sin(fase + 1.6)) * 0.6 * amp] });

// ---------- la barra, la caja y la hornalla con fuego ----------
function crearBarra(g) {
  const mad = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.5 }), marmol = new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.25 }), bronce = new THREE.MeshStandardMaterial({ color: 0x9a7432, metalness: 0.9, roughness: 0.35 });
  const caja = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  caja(0.45, 1.06, 3.0, mad, 3.28, PISO + 0.53, 2.4); caja(0.55, 0.04, 3.08, marmol, 3.26, PISO + 1.08, 2.4);
  for (let k = 0; k < 6; k++) caja(0.02, 0.8, 0.42, new THREE.MeshStandardMaterial({ color: 0x2a190e, roughness: 0.6 }), 3.04, PISO + 0.5, 1.15 + k * 0.5); // paneles
  caja(0.36, 0.2, 0.3, bronce, 3.25, PISO + 1.2, 3.55); caja(0.3, 0.12, 0.26, bronce, 3.25, PISO + 1.34, 3.53).rotation.z = -0.35; // la caja registradora
}
function texLlama() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const f = g.createRadialGradient(64, 80, 4, 64, 70, 60); f.addColorStop(0, 'rgba(255,240,200,1)'); f.addColorStop(0.3, 'rgba(255,160,50,.9)'); f.addColorStop(0.7, 'rgba(220,60,10,.35)'); f.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = f; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }

export function crearTrabajadores(escena, { caos = [0, 22], orden = [38.4, 60] } = {}) {
  const g = new THREE.Group(); escena.add(g); crearBarra(g);
  const r = rng(2468), cam = new THREE.Vector3();
  // la hornalla: dos sartenes, fuego que titila y una llamarada en cada salto
  const tl = texLlama(), llamas = [];
  for (const x of [0.1, 0.45]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tl, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(x, 0.02, -1.62); sp.scale.set(0.22, 0.2, 1); g.add(sp); llamas.push(sp);
    const sarten = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.7, roughness: 0.4 })); sarten.position.set(x, 0.0, -1.62); g.add(sarten);
  }
  const luzFuego = new THREE.PointLight(new THREE.Color(1, 0.55, 0.2), 0, 4, 2); luzFuego.position.set(0.28, 0.25, -1.45); g.add(luzFuego);

  // el elenco
  const mozo1 = silueta(g, { alto: 1.78, ropa: '#0d0e12' }), mozo2 = silueta(g, { alto: 1.72, ropa: '#100d0e' });
  const barman = silueta(g, { alto: 1.8, ropa: '#0f1013' }), cajera = silueta(g, { alto: 1.66, ropa: '#120f10' }), cocinero = silueta(g, { alto: 1.82, ropa: '#1a1918' });
  const llaman = [[2.1, 6.56], [-2.3, 7.64], [2.66, 10.8]].map(([x, z]) => ({ s: silueta(g, { alto: 1.0, ropa: '#0e0f12' }), x, z, f: r() * 6 }));
  // el mozo solo, apurado: pasa al lado de la cámara cuando entra, va y viene del pase y zigzaguea entre las mesas
  const R1 = [[0, 0.9, 9.0], [1.8, -1.0, 6.4], [3.4, 0.8, 3.6], [4.3, 0.55, 1.5], [4.9, 0.55, 1.5], [6.0, 1.15, 5.0], [7.0, 1.15, 8.4], [7.8, -0.4, 10.0], [8.6, -1.1, 9.2]];
  { let t = 8.6, x = -1.1, z = 9.2; const pts = [[0.6, 1.45], [-1.0, 4.4], [1.1, 7.0], [-0.9, 10.1], [1.0, 8.0], [-1.1, 5.2], [0.5, 1.45], [1.1, 3.8], [-1.0, 6.9], [0.9, 10.0], [-0.6, 7.5], [0.6, 1.45], [-1.1, 3.4], [1.1, 6.0], [-0.8, 9.6]]; for (const [nx, nz] of pts) { t += Math.hypot(nx - x, nz - z) / 2.3; R1.push([t, nx, nz]); if (nz < 2) { t += 0.5; R1.push([t, nx, nz]); } x = nx; z = nz; } }
  // después, tranquilos: los dos mozos llevan platos a las mesas
  const R1b = [[43.0, 0.6, 1.45], [43.6, 0.6, 1.45], [45.2, 1.4, 5.2], [46.4, 1.4, 5.2], [48.0, 0.5, 1.45], [49.2, 0.9, 3.6]];
  const R2 = [[38.6, 0.2, 11.4], [40.4, -0.3, 1.5], [43.4, -0.3, 1.5], [44.9, -1.5, 3.4], [46.2, -1.5, 3.4], [47.6, -0.4, 1.5], [49.2, -1.2, 5.6]];
  const r1 = recorrido(R1), r1b = recorrido(R1b), r2 = recorrido(R2);

  return {
    grupo: g, luzFuego,
    poner(t, camara) {
      cam.copy(camara.position);
      const enCaos = t >= caos[0] && t < caos[1], enOrden = t >= orden[0];
      // mozo 1
      { const q = enOrden ? r1b(t) : r1(t), apurado = !enOrden, fase = q.d / (apurado ? 1.25 : 1.05) * Math.PI * 2, amp = sat(q.v / 0.6);
        mozo1.m.visible = enCaos || enOrden;
        if (mozo1.m.visible) { mozo1.dibujar({ ...caminar(fase, amp), delantal: true, bandeja: true, brazoD: [Math.PI - 0.5, -0.9 + Math.sin(t * 9) * 0.04 * amp], brazoI: [-0.15 - Math.sin(fase) * 0.35 * amp, 0.2] }); mozo1.poner(q.x, PISO + Math.abs(Math.sin(fase)) * 0.02 * amp, q.z, cam); mozo1.m.rotation.z = (apurado ? 0.06 : 0.02) * amp * Math.sin(fase); } }
      // mozo 2 (llegó por Oído)
      { const q = r2(t), fase = q.d / 1.05 * Math.PI * 2, amp = sat(q.v / 0.6); mozo2.m.visible = t >= R2[0][0];
        if (mozo2.m.visible) { mozo2.dibujar({ ...caminar(fase, amp), delantal: true, bandeja: t > 43.4, brazoD: t > 43.4 ? [Math.PI - 0.6, -0.8] : [0.15 + Math.sin(fase) * 0.3 * amp, 0.25], brazoI: [-0.15 - Math.sin(fase) * 0.3 * amp, 0.2], pelo: true }); mozo2.poner(q.x, PISO + Math.abs(Math.sin(fase)) * 0.02 * amp, q.z, cam); } }
      // barman: sirve rápido en el caos, más calmo después
      { const ritmo = enCaos ? 5.5 : 2.2, u = (Math.sin(t * ritmo) + 1) / 2; barman.m.visible = enCaos || enOrden;
        barman.dibujar({ botella: -0.4 - u * 1.6, brazoD: [-2.1 - u * 0.4, -0.9], brazoI: [0.6, 1.2] }); barman.poner(3.72, PISO, 2.2 + Math.sin(t * 0.7) * 0.15, cam); }
      // cajera
      { cajera.m.visible = enCaos || enOrden; const u = Math.max(0, Math.sin(t * (enCaos ? 4.2 : 1.6)));
        cajera.dibujar({ brazoD: [-0.9 - u * 0.5, -0.6], brazoI: [-0.5, -0.4], pelo: true }); cajera.poner(3.72, PISO, 3.55, cam); }
      // cocinero de espaldas: sacude la sartén; en cada salto, una llamarada
      { const per = enCaos ? 1.1 : 1.8, u = (t % per) / per, salto = Math.sin(Math.PI * sat(u / 0.35));
        cocinero.m.visible = true;
        cocinero.dibujar({ chaqueta: true, gorro: true, claro: '#b9b2a6', brazoD: [-1.2 - salto * 0.5, -0.4 - salto * 0.3], brazoI: [0.9, 0.9], sarten: -0.2 - salto * 0.6 });
        cocinero.poner(0.28, PISO, -1.12, cam);
        const fl = 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 17), llamarada = enCaos ? Math.pow(Math.max(0, 1 - (u - 0.3) / 0.25), 2) * (u > 0.3 ? 1 : 0) : 0;
        llamas.forEach((l, i) => { const s = (0.22 + (i === 1 ? llamarada * 0.5 : 0)) * fl; l.scale.set(s, s * (1 + (i === 1 ? llamarada : 0)), 1); l.position.y = 0.04 + (i === 1 ? llamarada * 0.1 : 0); l.material.opacity = 0.9; });
        luzFuego.intensity = (1.2 + llamarada * 3) * fl;
      }
      // mesas que llaman con la mano (sólo en el caos)
      for (const L of llaman) { L.s.m.visible = enCaos; if (!enCaos) continue; const w = Math.sin(t * 7 + L.f); L.s.dibujar({ sentada: true, brazoD: [Math.PI - 0.3 + w * 0.25, -0.5 + w * 0.3], brazoI: [-0.3, 0.6] }); L.s.poner(L.x, PISO + 0.2, L.z, cam); }
    },
  };
}
