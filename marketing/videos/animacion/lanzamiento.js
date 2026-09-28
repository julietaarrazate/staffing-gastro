// Lo que no es CSS: el tipeo, el contador de postulantes y el reloj.
const typedFull = "Necesito un mozo hoy de 21 a 2, pago 45.000";
return (t, { clamp, easeOut, $ }) => {
  const n = Math.round(clamp((t - 6.55) / 1.45) * typedFull.length);
  $("typed").textContent = typedFull.slice(0, n);
  const typing = t > 6.55 && t < 8.0;
  $("caret").style.opacity = t > 6.3 && t < 8.3 && (typing || Math.floor(t * 2.5) % 2 === 0) ? 1 : 0;
  const c = t < 12.95 ? 1 : t < 13.45 ? 2 : 3;
  $("count").textContent = c;
  $("countLabel").textContent = c === 1 ? "postulante" : "postulantes";
  const secs = Math.round(easeOut(clamp((t - 15.35) / 1.4)) * 462);
  $("timer").textContent = String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0");
};
