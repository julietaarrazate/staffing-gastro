/** Arranca la app de nuevo desde el inicio, con carga completa. Lo usa la
 * sesión cuando cambió de manos en otra pestaña: no queda nada de la cuenta
 * anterior en memoria, y el inicio lleva a cada cuenta a su pantalla (un
 * trabajador no queda parado en el panel del comercio, que era donde estaba
 * la pestaña). Está aparte para poder reemplazarla en los tests. */
export function restartAtHome(): void {
  window.location.replace("/");
}
