// Lo que no es CSS: el tipeo y el grano. Las palabras al ritmo de la voz las
// reparte render.mjs, leyendo historia.guion.json.
const tipeo = "Necesito un mozo hoy de 21 a 2, pago 45.000";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 29.9) / 1.5) * tipeo.length);
  $("typed").textContent = tipeo.slice(0, n);
  const tipeando = t > 29.9 && t < 31.4;
  $("caret").style.opacity = t > 29.6 && t < 31.6 && (tipeando || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97)); // el grano cambia 12 veces por segundo, como película
};
