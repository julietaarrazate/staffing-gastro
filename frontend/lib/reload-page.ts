/** Recarga la página entera. Está aparte para poder reemplazarla en los
 * tests (jsdom no implementa `location.reload`). */
export function reloadPage(): void {
  window.location.reload();
}
