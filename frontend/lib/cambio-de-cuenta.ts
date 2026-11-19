/**
 * Lo que se guarda en el navegador está atado a la CUENTA, no a la sesión.
 *
 * Cuando la sesión vence o se revoca, la misma persona vuelve a entrar y
 * retoma lo que estaba haciendo (el borrador de «Publicar» sigue ahí). En
 * cambio, cuando entra OTRA cuenta, o la cuenta sale a propósito, nada de lo
 * anterior pasa a la que sigue (computadora compartida).
 *
 * `limpiarDeLaCuentaAnterior` es esa limpieza: la llaman el cierre de sesión
 * voluntario, el cierre desde otra pestaña y el ingreso de una cuenta
 * distinta a la anterior. El fin por vencimiento o revocación NO la llama.
 */

import {
  borrarBorradores,
  borrarSesion,
  leerSesion,
  guardarSesion,
} from "@/lib/almacen-sesion";
import { borrarPlanElegido } from "@/lib/plan-elegido";
import { clearAllCached } from "@/lib/screen-cache";

/** Claves del asistente de IA (las usa `use-ai-assistant.ts`, que las
 * reexporta; viven acá para que `auth-context` no dependa de ese hook). */
export const AI_SHIFT_DRAFT_STORAGE_KEY = "staffya_ai_shift_draft";
export const AI_EVENT_DRAFT_STORAGE_KEY = "staffya_ai_event_draft";

/** La última cuenta que tuvo sesión en esta pestaña. Sobrevive al vencimiento
 * (para saber, al volver a entrar, si es la misma) y se borra al limpiar. */
const CLAVE_ULTIMA_CUENTA = "staffya_ultima_cuenta";

export function recordarUltimaCuenta(userId: string): void {
  guardarSesion(CLAVE_ULTIMA_CUENTA, userId);
}

/** `true` si la cuenta que entra no es la que tuvo la sesión antes en esta
 * pestaña. Sin cuenta anterior conocida no hay nada que comparar. */
export function esOtraCuenta(userId: string): boolean {
  const anterior = leerSesion<string>(CLAVE_ULTIMA_CUENTA);
  return anterior !== null && anterior !== userId;
}

export function limpiarDeLaCuentaAnterior(): void {
  borrarBorradores();
  borrarSesion(AI_SHIFT_DRAFT_STORAGE_KEY);
  borrarSesion(AI_EVENT_DRAFT_STORAGE_KEY);
  borrarSesion(CLAVE_ULTIMA_CUENTA);
  borrarPlanElegido();
  clearAllCached();
}
