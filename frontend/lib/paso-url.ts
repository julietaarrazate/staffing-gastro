/**
 * El paso de un asistente va en la dirección (`?paso=2`), así «Atrás» del
 * navegador vuelve al paso anterior en vez de sacar a la persona del asistente.
 * El paso 0 no lleva parámetro (dirección limpia).
 */

/** Lee `?paso=` y lo deja dentro de 0..max; cualquier cosa rara es el paso 0. */
export function pasoDeUrl(raw: string | null, max: number): number {
  if (raw == null || !/^\d+$/.test(raw)) return 0;
  return Math.min(Number(raw), max);
}

/** Dirección del asistente en ese paso. */
export function urlDePaso(base: string, paso: number): string {
  return paso > 0 ? `${base}?paso=${paso}` : base;
}

/**
 * Hasta qué paso se puede llegar con lo que hay cargado: `listos[i]` dice si
 * el paso `i` está completo. Una dirección `?paso=3` abierta en frío (recarga
 * sin borrador, enlace viejo) no se salta pasos incompletos.
 */
export function pasoAlcanzable(pedido: number, listos: boolean[]): number {
  let max = 0;
  while (max < listos.length && listos[max]) max++;
  return Math.min(pedido, max);
}
