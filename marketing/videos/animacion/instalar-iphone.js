// Lo que no es CSS: la dirección que se tipea en el paso 1 y el grano. Las
// palabras al ritmo del guion las reparte render.mjs. Generado junto con
// instalar.py (mismo contenido en los dos sistemas).
const url = "oido.com.ar";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 3.6) / 1.0) * url.length);
  $("url").textContent = url.slice(0, n);
  $("caret").style.opacity = t > 3.3 && t < 5.2 && (t < 4.6 || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97));
};
