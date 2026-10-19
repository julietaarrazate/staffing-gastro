// Lo que no es CSS: el interruptor de "Disponible ahora", el botón que se
// confirma y el monto cobrado.
return (t, { clamp, easeOut, $ }) => {
  $("dispSub").textContent = t < 6.85 ? "Apagado" : "Los comercios te ven cerca";
  $("confirmBtn").textContent = t < 12.5 ? "Confirmar que voy" : "Confirmado";
  $("confirmBtn").style.background = t < 12.5 ? "#D97706" : "#1B3A31";
  const v = Math.round(easeOut(clamp((t - 17.3) / 0.9)) * 45) * 1000;
  $("amount").textContent = v.toLocaleString("es-AR");
};
