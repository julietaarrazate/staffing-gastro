// Deja la presentación lista para grabarla: le agrega un reloj manual (tick), la lectura del estado y dos llaves para no dibujar ni pausar.
// No cambia nada de lo que se ve ni de lo que suena. Uso: node preparar.js <presentacion.html> <render.html> <render-audio.html>
const fs = require('fs');
const [, , inFile, outRender, outAudio] = process.argv;
const una = (s, a, b, veces = 1) => { const n = s.split(a).length - 1; if (n !== veces) throw new Error(n + ' coincidencias (esperaba ' + veces + ') para ' + a); return s.split(a).join(b); };

let h = fs.readFileSync(inFile, 'utf8');
// reloj manual y estado, junto a la API de prueba que la presentación ya trae
h = una(h, 'st.test={resize:Mt,draw:at,', 'st.test={resize:Mt,draw:at,tick(W){R=!0;Et(W)},state(){return{g,tr:b?{name:b.name,p:b.p,to:b.to}:null,beat:g>=0?m[g].s.beat:0,auto:M}},');
// la pasada de sonido avanza sin dibujar
h = una(h, 'try{nt(g)}catch{', 'try{window.__NODRAW||nt(g)}catch{', 2);
// y sin que el motor de audio se pause por estar la pestaña en segundo plano
h = una(h, 'park(D){!this.ready||n||', 'park(D){!this.ready||n||window.__NOPARK||');
h = una(h, 'N=()=>{if(n)return;', 'N=()=>{if(n||window.__NOPARK)return;');
fs.writeFileSync(outRender, h);

// para el sonido, además, se exponen el banco de muestras y el motor: así se sintetizan todas antes de grabar
h = una(h, 't=t||D3(k3()),', 't=t||D3(k3()),window.__BANK=t,');
h = una(h, 'e.E||(e.E=U3(y,t),', 'e.E||(e.E=window.__ENG=U3(y,t),');
fs.writeFileSync(outAudio, h);
console.log('ok', outRender, outAudio);
