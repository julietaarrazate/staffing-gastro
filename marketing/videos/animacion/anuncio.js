// Lo que no es CSS: el tipeo y el grano. Las palabras al ritmo del guion las
// reparte render.mjs, leyendo anuncio.guion.json.
const tipeo = "Necesito un mozo hoy de 21 a 2";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 6.8) / 1.2) * tipeo.length);
  $("typed").textContent = tipeo.slice(0, n);
  const tipeando = t > 6.8 && t < 8.0;
  $("caret").style.opacity = t > 6.6 && t < 8.2 && (tipeando || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97)); // grano de película, 12 veces por segundo
};
