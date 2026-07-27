/**
 * Caché en memoria por pantalla, con patrón "stale-while-revalidate".
 *
 * Sin esto, cada vez que el usuario vuelve a una pestaña la pantalla arranca
 * en `loading` y muestra el esqueleto entero, aunque haya estado ahí hace
 * cinco segundos: se siente lenta aunque la red sea rápida. Con esto, la
 * segunda visita pinta al instante lo último que se vio y refresca en segundo
 * plano — que es lo que hace que una app se sienta nativa.
 *
 * Deliberadamente simple (un `Map` de módulo, sin librería): vive lo que vive
 * la pestaña del navegador y se limpia sola al recargar. No es persistencia,
 * es continuidad de sesión. Si algún día hace falta invalidación fina o
 * revalidación por foco, ahí sí conviene traer SWR/React Query.
 */
const cache = new Map<string, unknown>();

/** Lo último que se mostró para esta clave, si el usuario ya estuvo acá. */
export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/** Guarda el resultado fresco para que la próxima visita pinte al instante. */
export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

/**
 * Invalida una entrada. Usar cuando una mutación deja el caché mentiroso
 * (p. ej. el comercio cancela un turno y vuelve al panel).
 */
export function clearCached(key: string): void {
  cache.delete(key);
}
