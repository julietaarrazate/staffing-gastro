/**
 * Aviso de "te mandamos un mail para confirmar tu dirección" tras el alta con
 * email y contraseña (U042). El alta termina en `/bienvenida`, otra pantalla:
 * el aviso viaja por `sessionStorage` (esta pestaña, una sola vez) y la
 * bienvenida lo muestra y lo borra. Cada acceso va con try/catch: sin
 * almacenamiento el alta sigue igual, sólo que sin el aviso.
 */

const CLAVE = "staffya_aviso_mail";

export const AVISO_MAIL =
  "Te mandamos un mail para confirmar tu dirección. Si no lo ves, revisá la carpeta de spam.";

export function guardarAvisoMail(): void {
  try {
    window.sessionStorage.setItem(CLAVE, "1");
  } catch {
    // Sin almacenamiento: no se muestra el aviso.
  }
}

/** `true` una sola vez: lee el aviso y lo borra. */
export function tomarAvisoMail(): boolean {
  try {
    const hay = window.sessionStorage.getItem(CLAVE) === "1";
    if (hay) window.sessionStorage.removeItem(CLAVE);
    return hay;
  } catch {
    return false;
  }
}
