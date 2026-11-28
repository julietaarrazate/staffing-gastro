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
} else {
  console.log('modo: video | comparar'); process.exit(1);
}
