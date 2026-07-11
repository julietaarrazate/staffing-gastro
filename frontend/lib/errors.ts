import { ApiError } from "./api";

/**
 * Traduce cualquier error atrapado en un `catch` a un mensaje apto para
 * mostrarle al usuario. Los `ApiError` ya traen el mensaje del backend (en
 * español); cualquier otra cosa —típicamente un `TypeError: Failed to fetch`
 * cuando el navegador no puede ni siquiera completar el request— es un error
 * de red crudo en inglés que nunca debe llegar a la UI, así que lo pisamos
 * con un mensaje genérico.
 */
export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback ?? "No pudimos conectar. Revisá tu conexión e intentá de nuevo.";
}

/** Azúcar para el caso más común de manejo por status: recurso no encontrado. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
