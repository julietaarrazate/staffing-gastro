// Une los tramos dibujados y el sonido capturado en un MP4. Uso: node armar.js <cuadros> <corte.json> <sonido.wav> <placa.png> <salida.mp4> <ancho> <alto> [kbps máx]
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const [,, dir, cutFile, wav, card, out, W, H, maxk] = process.argv, fps = 30, cut = JSON.parse(fs.readFileSync(cutFile, 'utf8'));
const tmp = path.join(dir, '_seq'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
let n = 0; const dur = [];
cut.forEach((s, i) => { const fr = fs.readdirSync(dir).filter(f => f.startsWith('s' + String(i).padStart(2, '0') + '_')).sort(); if (!fr.length) throw new Error('faltan cuadros del tramo ' + i); dur.push(fr.length / fps); for (const f of fr) fs.linkSync(path.join(dir, f), path.join(tmp, String(n++).padStart(6, '0') + '.jpg')); });
const total = n / fps, CARD = 3.2, XF = .5; // la placa entra con un fundido de medio segundo
const af = cut.map((s, i) => `[1:a]atrim=start=${s[0]}:end=${(s[0] + dur[i]).toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=${(dur[i] - .09).toFixed(4)}:d=0.09[a${i}]`).join(';');
const fc = `[0:v]scale=${W}:${H}:flags=lanczos,format=yuv420p,fade=t=in:d=0.25[v0];[2:v]scale=${W}:${H}:flags=lanczos,format=yuv420p,fps=${fps}[c];[v0][c]xfade=transition=fade:duration=${XF}:offset=${(total - XF).toFixed(3)},fade=t=out:st=${(total + CARD - XF - .6).toFixed(3)}:d=0.6[v];` +
  af + ';' + cut.map((_, i) => `[a${i}]`).join('') + `concat=n=${cut.length}:v=0:a=1,apad=pad_dur=${CARD},loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${(total + CARD - XF - 1).toFixed(3)}:d=1[a]`;
const rate = maxk ? ['-crf', '22', '-maxrate', maxk + 'k', '-bufsize', (2 * maxk) + 'k'] : ['-crf', '18'];
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%06d.jpg'), '-i', wav, '-loop', '1', '-t', String(CARD), '-i', card, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', ...rate, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', (total + CARD - XF).toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(path.basename(out), (total + CARD - XF).toFixed(1) + ' s', (fs.statSync(out).size / 1e6).toFixed(1) + ' MB');
