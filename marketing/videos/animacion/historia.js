// Lo que no es CSS. Al cargar: parte en palabras cada texto con data-v y a
// cada palabra le da el delay del momento en que la voz la dice (interpolado
// por letras dentro de la línea del guion). En cada cuadro: el tipeo y el grano.
const lineas = Object.fromEntries(window.GUION.lineas.map((l) => [l.id, l]));
const norm = (w) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9ñ]/g, "");
const ADELANTO = 0.08; // la palabra aparece apenas antes de oírse: se lee a la par

for (const el of document.querySelectorAll("#stage [data-v]")) {
  const ln = lineas[el.dataset.v];
  const dichas = ln.texto.split(/\s+/);
  const inicio = [];
  let acc = 0;
  for (const w of dichas) { inicio.push(acc); acc += w.length + 1; }
  const tokens = el.textContent.trim().replace(/\|/g, " | ").split(/\s+/);
  const palabras = tokens.filter((t) => t !== "|");
  let j = dichas.findIndex((w) => norm(w) === norm(palabras[0].replace(/\*/g, "")));
  if (j < 0) j = 0;
  el.textContent = "";
  for (const t of tokens) {
    if (t === "|") { el.appendChild(document.createElement("br")); continue; }
    const k = Math.min(j++, dichas.length - 1);
    const sp = document.createElement("span");
    sp.className = t.startsWith("*") ? "w " + (el.closest("#s1,#s2") ? "acc" : "acc2") : "w";
    sp.textContent = t.replace(/\*/g, "");
    sp.style.animationDelay = `${(ln.at + (ln.dur * inicio[k]) / acc - ADELANTO).toFixed(3)}s`;
    el.append(sp, " ");
  }
}

const tipeo = "Necesito un mozo hoy de 21 a 2, pago 45.000";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 29.9) / 1.5) * tipeo.length);
  $("typed").textContent = tipeo.slice(0, n);
  const tipeando = t > 29.9 && t < 31.4;
  $("caret").style.opacity = t > 29.6 && t < 31.6 && (tipeando || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97)); // el grano cambia 12 veces por segundo, como película
};
