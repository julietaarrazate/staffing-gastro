// Lo que no es CSS: el tipeo del paso 1, el contador de postulantes del
// paso 2 y el grano. Las palabras al ritmo del guion las reparte render.mjs.
const tipeo = "Necesito un bartender el sábado de 20 a 2, pago 50.000";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 4.65) / 1.3) * tipeo.length);
  $("typed").textContent = tipeo.slice(0, n);
  const tipeando = t > 4.65 && t < 5.95;
  $("caret").style.opacity = t > 4.4 && t < 6.3 && (tipeando || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  const c = t < 11.05 ? 1 : t < 11.35 ? 2 : 3;
  $("count").textContent = c;
  $("countLabel").textContent = c === 1 ? "postulante" : "postulantes";
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97));
};
