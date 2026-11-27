// Busca el pitido de sincronía (1 kHz, un segundo antes del cuadro cero) y recorta el sonido para que su segundo 0 sea el cuadro 0.
// Uso: node recortar-sonido.js <sonido.webm> <sonido.wav>
const { execFileSync } = require('child_process');
const [, , inFile, outWav] = process.argv, SR = 48000;
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-t', '8', '-i', inFile, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 26 });
const N = 240, w = 2 * Math.PI * 1000 / SR, c = 2 * Math.cos(w); // ventanas de 5 ms, filtro de Goertzel en 1 kHz
let pitido = -1;
for (let o = 0; o + N <= pcm.length / 2 && pitido < 0; o += N / 2) {
  let s1 = 0, s2 = 0, e = 0;
  for (let i = 0; i < N; i++) { const x = pcm.readInt16LE((o + i) * 2) / 32768, s0 = x + c * s1 - s2; s2 = s1; s1 = s0; e += x * x; }
  const tono = (s1 * s1 + s2 * s2 - c * s1 * s2) / (N * N / 4), rms = e / N;
  if (rms > 1e-3 && tono > .6 * rms * 2) pitido = o / SR; // casi toda la energía de la ventana está en 1 kHz
}
if (pitido < 0) throw new Error('no encontré el pitido en los primeros 8 segundos');
const cero = pitido + 1;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', cero.toFixed(4), '-i', inFile, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', outWav], { stdio: 'inherit' });
console.log('pitido en', pitido.toFixed(4), 's · cuadro cero en', cero.toFixed(4), 's ·', outWav);
