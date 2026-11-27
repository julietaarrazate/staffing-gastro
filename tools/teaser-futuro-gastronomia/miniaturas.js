// Reemplaza las miniaturas embebidas por capturas de la versión adaptada. Uso: node miniaturas.js <presentacion.html> <carpeta de capturas>
const fs = require('fs'); const [, , file, dir] = process.argv; let html = fs.readFileSync(file, 'utf8'), n = 0;
for (const f of fs.readdirSync(dir)) { const id = /^\d+_([a-z]+)_/.exec(f)[1], key = `"thumb-${id}.jpg":"data:image/jpeg;base64,`, a = html.indexOf(key); if (a < 0) { console.log('no está', id); continue; }
  const b = html.indexOf('"', a + key.length); html = html.slice(0, a + key.length) + fs.readFileSync(dir + '/' + f).toString('base64') + html.slice(b); n++; }
fs.writeFileSync(file, html); console.log('miniaturas', n, (html.length / 1e6).toFixed(2) + ' MB');
