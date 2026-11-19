/**
 * Armado de CSV para descargar desde el panel (comercios a captar, serie
 * semanal de Métricas): una sola regla para escapar y neutralizar fórmulas.
 */

/** Una celda: entre comillas si hace falta, y sin que Excel la ejecute. */
export function csvCell(value: string): string {
  // Una celda que empieza con = + - @ la ejecuta Excel como fórmula: se
  // neutraliza con una comilla simple (los datos pueden venir de afuera:
  // un mapa público, un `?ref=` que escribió cualquiera).
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV con BOM para que Excel abra bien los acentos. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\n")}`;
}

/** Descarga `contenido` como archivo, desde el navegador. */
export function downloadCsv(contenido: string, nombre: string): void {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
