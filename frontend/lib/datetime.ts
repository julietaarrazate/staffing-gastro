/**
 * Helpers de fecha/hora con el huso horario de Argentina.
 *
 * Argentina usa UTC-3 todo el año (no aplica horario de verano), así que para
 * mandar al backend alcanza con fijar el offset -03:00, y para mostrar usamos
 * Intl con la zona horaria explícita: así un turno se ve siempre en hora de
 * Argentina sin importar la configuración del dispositivo de quien mira.
 */

export const AR_TIMEZONE = "America/Argentina/Buenos_Aires";
const AR_OFFSET = "-03:00";

/**
 * Convierte el valor de un <input type="datetime-local"> (hora de pared, sin
 * zona) a un ISO con el offset de Argentina, para enviar un instante
 * inequívoco. Ej: "2026-06-22T20:00" -> "2026-06-22T20:00:00-03:00".
 */
export function localInputToArgentinaISO(value: string): string {
  if (!value) return value;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}${AR_OFFSET}`;
}

/**
 * Convierte un ISO (con zona) al formato de <input type="datetime-local">
 * mostrando la hora de pared de Argentina. Sirve para precargar formularios.
 */
export function argentinaISOToLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatShiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: AR_TIMEZONE });
}

export function formatShiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: AR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rango legible: si empieza y termina el mismo día, la fecha aparece una vez. */
export function formatShiftRange(startIso: string, endIso: string): string {
  const date = formatShiftDate(startIso);
  const sameDay = date === formatShiftDate(endIso);
  if (sameDay) {
    return `${date} · ${formatShiftTime(startIso)} a ${formatShiftTime(endIso)}`;
  }
  return `${date} ${formatShiftTime(startIso)} → ${formatShiftDate(endIso)} ${formatShiftTime(endIso)}`;
}
