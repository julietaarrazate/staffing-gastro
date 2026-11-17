import { ApiError, NetworkError } from "./api";

/**
 * Traduce cualquier error atrapado en un `catch` a un mensaje apto para
 * mostrarle al usuario. Los `ApiError` ya traen el mensaje del backend (en
 * español); cualquier otra cosa —típicamente un `TypeError: Failed to fetch`
 * cuando el navegador no puede ni siquiera completar el request— es un error
 * de red crudo en inglés que nunca debe llegar a la UI, así que lo pisamos
 * con un mensaje genérico.
 */
const SIN_CONEXION = "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.";

export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) return err.message;
  // Sin red o timeout: se dice qué pasó. Con fallback (el texto de la acción,
  // «No se pudo publicar el turno») se le suma el motivo, no se lo pisa.
  const sinRed =
    err instanceof NetworkError
      ? err.message
      : err instanceof TypeError && /fetch|network|load failed/i.test(err.message)
        ? SIN_CONEXION
        : null;
  if (sinRed) {
    if (!fallback) return sinRed;
    const accion = fallback.replace(/[\s.:]+$/, "");
    return `${accion}: ${sinRed.charAt(0).toLowerCase()}${sinRed.slice(1)}`;
  }
  return fallback ?? SIN_CONEXION;
}

/** Azúcar para el caso más común de manejo por status: recurso no encontrado. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * El backend mapea el límite de plan a **402 Payment Required**
 * (PlanLimitExceededError, ADR-0005 Fase 1) — un código específico que el
 * endpoint de publicar turno no usa para ninguna otra cosa. Se distingue por
 * ese 402 exacto (NO por 403, que sí puede venir de un problema de permisos)
 * para mostrar el mensaje + CTA "Mejorá tu plan" en vez de un toast genérico.
 */
export function isPlanLimitError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
