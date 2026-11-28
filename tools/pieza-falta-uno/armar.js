// Une cuadros y sonido en MP4, y arma la comparación lado a lado con un tramo del teaser.
// Uso: node armar.js video <carpeta de cuadros> <sonido.wav> <salida.mp4> [ancho=1080] [alto=1920] [kbps: vacío = máxima calidad]
//      node armar.js comparar <nuestro.mp4> <teaser.mp4> <desde s> <hasta s> <salida.mp4>
const { execFileSync } = require('child_process');
const [,, modo, ...a] = process.argv;
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const FUENTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

if (modo === 'video') {
  const [dir, wav, sal, w = '1080', h = '1920', kbps = ''] = a;
  const v = ['-framerate', '30', '-pattern_type', 'glob', '-i', `${dir}/*.jpg`, '-i', wav,
    '-vf', `scale=${w}:${h}:flags=lanczos,unsharp=5:5:0.35:5:5:0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart'];
  if (kbps) v.push('-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.4) + 'k', '-bufsize', kbps * 2 + 'k'); else v.push('-crf', '17', '-tune', 'film');
  ff([...v, '-c:a', 'aac', '-b:a', kbps ? '160k' : '256k', '-ar', '48000', '-shortest', sal]);
} else if (modo === 'comparar') {
  const [nuestro, teaser, desde, hasta, sal] = a, dur = +hasta - +desde;
  const rotulo = t => `drawtext=fontfile=${FUENTE}:text='${t}':x=28:y=34:fontsize=30:fontcolor=0xf1ebdf:box=1:boxcolor=0x0b1424@0.72:boxborderw=14`;
  ff(['-i', nuestro, '-ss', desde, '-t', String(dur), '-i', teaser,
    '-filter_complex', `[0:v]scale=720:1280:flags=lanczos,${rotulo('Falta uno · escena 3')}[a];[1:v]scale=720:1280:flags=lanczos,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=10,${rotulo('Teaser · la torre')}[b];[a][b]hstack=2,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', sal]);
} else if (modo === 'corte') {
  // node armar.js corte <cuadros> <cuadros-extra> <sonido.wav> <guion.json> <nombre> <salida.mp4> [marca.png]
  const [dir, dirExtra, wav, guionF, nombre, sal, marca] = a, fs = require('fs'), path = require('path');
  const tramos = JSON.parse(fs.readFileSync(guionF, 'utf8')).cortes[nombre].tramos, F = 0.2, tmp = sal + '.tmp'; fs.mkdirSync(tmp, { recursive: true });
  const partes = tramos.map(([t0, t1], i) => {
    const d = t0 >= 69 ? dirExtra : dir, f0 = Math.round(t0 * 30), n = Math.round((t1 - t0) * 30), o = path.join(tmp, `p${i}.mkv`);
    ff(['-framerate', '30', '-start_number', String(f0), '-i', `${d}/c%05d.jpg`, '-ss', String(t0), '-t', String(t1 - t0), '-i', wav, '-frames:v', String(n),
      '-vf', 'scale=1080:1920:flags=lanczos,unsharp=5:5:0.35:5:5:0,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-c:a', 'pcm_s24le', '-ar', '48000', o]);
    return { o, dur: n / 30 };
  });
  const ent = partes.flatMap(p => ['-i', p.o]); let fv = '', fa = '', acc = partes[0].dur, lv = '0:v', la = '0:a';
  for (let i = 1; i < partes.length; i++) { const ov = `v${i}`, oa = `a${i}`; fv += `[${lv}][${i}:v]xfade=transition=fade:duration=${F}:offset=${(acc - F).toFixed(3)}[${ov}];`; fa += `[${la}][${i}:a]acrossfade=d=${F}[${oa}];`; acc += partes[i].dur - F; lv = ov; la = oa; }
  let fin = `[${lv}]null[vf]`; const extra = [];
  if (marca) { extra.push('-i', marca); fin = `[${partes.length}:v]format=rgba,colorchannelmixer=aa=0.85[mk];[${lv}][mk]overlay=W-w-54:54[vf]`; }
  ff([...ent, ...extra, '-filter_complex', fv + fa + fin, '-map', '[vf]', '-map', `[${la}]`, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '256k', sal]);
  fs.rmSync(tmp, { recursive: true });
} else {
  console.log('modo: video | comparar | corte'); process.exit(1);
}
