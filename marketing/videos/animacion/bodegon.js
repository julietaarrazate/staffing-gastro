// Lo que no es CSS: el tipeo del pedido, los minutos que bajan y el grano.
const tipeo = "Necesito un mozo hoy de 21 a 2, pago 70.000";
return (t, { clamp, $ }) => {
  const n = Math.round(clamp((t - 9.3) / 1.5) * tipeo.length);
  $("typed").textContent = tipeo.slice(0, n);
  const tipeando = t > 9.3 && t < 10.8;
  $("caret").style.opacity = t > 9.1 && t < 11.3 && (tipeando || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  $("min").textContent = String(Math.max(2, Math.round(8 - clamp((t - 16.6) / 2.6) * 6)));
  $("grainT").setAttribute("seed", String(Math.floor(t * 12) % 97)); // grano de película, 12 veces por segundo
};
