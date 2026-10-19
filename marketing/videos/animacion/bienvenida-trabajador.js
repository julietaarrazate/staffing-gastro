// Lo que no es CSS: el monto que sube en el paso 5 y el grano. Las palabras
// al ritmo del guion las reparte render.mjs.
return (t, { clamp, easeOut, $ }) => {
  const monto = Math.round(easeOut(clamp((t - 22.35) / 0.9)) * 45000);
  $("monto").textContent = monto.toLocaleString("es-AR");
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97));
};
