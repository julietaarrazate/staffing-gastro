// Aplica el guion al archivo de referencia: cambia textos por posición exacta (árbol sintáctico), sin tocar las imágenes ni los shaders. Uso: node adaptar.js <referencia.html> <guion.js> <salida.html>
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const [, , inFile, guionFile, outFile, verbose] = process.argv;
const { textos, prefijos, codigo } = require(require('path').resolve(guionFile));
let html = fs.readFileSync(inFile, 'utf8');
const i0 = html.indexOf('<script>', html.indexOf('window.__FONTS')) + 8, i1 = html.lastIndexOf('</script>');
let src = html.slice(i0, i1);
for (const [a, b] of codigo) { const n = src.split(a).length - 1; if (n !== 1) throw new Error('código: ' + n + ' coincidencias para ' + a.slice(0, 60)); src = src.replace(a, () => b); }
const ast = acorn.parse(src, { ecmaVersion: 'latest' });
const DESDE = src.indexOf('async function M3') - 2000, reps = [], usados = {}, usadosP = {};
const mira = (n, v) => {
  if (typeof v !== 'string' || n.start < DESDE) return;
  if (Object.prototype.hasOwnProperty.call(textos, v)) { reps.push([n.start, n.end, textos[v]]); (usados[v] = usados[v] || []).push(n.start); return; }
  for (const [p, nuevo] of prefijos) if (v.startsWith(p)) { reps.push([n.start, n.end, nuevo]); usadosP[p] = 1; }
};
walk.simple(ast, { Literal(n) { mira(n, n.value); }, TemplateLiteral(n) { if (!n.expressions.length) mira(n, n.quasis[0].value.cooked); } });
reps.sort((a, b) => b[0] - a[0]);
for (const [s, e, t] of reps) src = src.slice(0, s) + JSON.stringify(t) + src.slice(e);
const faltan = Object.keys(textos).filter(k => !usados[k]).concat(prefijos.filter(p => !usadosP[p[0]]).map(p => p[0]));
console.log('reemplazos:', reps.length, '· claves sin usar:', faltan.length); faltan.forEach(k => console.log('  SIN USAR:', JSON.stringify(k.slice(0, 70))));
if (verbose) for (const k of Object.keys(usados)) if (k.length < 9) console.log(JSON.stringify(k), usados[k].join(','));
acorn.parse(src, { ecmaVersion: 'latest' }); // tiene que seguir siendo código válido
html = html.slice(0, i0) + src + html.slice(i1);
html = html.replace('<title>The Last Boring Slide (Copy)</title>', '<title>El futuro de la gastronomía</title>').replace('aria-label="The presentation"', 'aria-label="Presentación de Oído: el futuro de la gastronomía"');
fs.writeFileSync(outFile, html); console.log('ok', outFile, (html.length / 1e6).toFixed(2) + ' MB');
