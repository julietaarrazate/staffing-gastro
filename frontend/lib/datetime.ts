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

/**
 * El día EN PALABRAS, con nombre de día de la semana: "sábado 20 de septiembre".
 *
 * Existe por un pedido concreto de Julieta (2026-09-16, probando la app):
 * *"colocar la fecha debería salir un calendario, así te asegurás bien el día
 * […] o alguna manera de aclarar para que no haya confusión"*.
 *
 * `20/09/2026` no previene el error, porque para verificarlo hay que hacer una
 * cuenta mental; **"sábado 20"** sí, porque el comercio no piensa en números de
 * día — piensa "el sábado a la noche". Si puso el viernes por error, la palabra
 * se lo grita y el número no.
 *
 * Deliberadamente NO lleva el año: un turno eventual se publica para los
 * próximos días, y el año es ruido que compite con el dato que importa.
 */
export function formatShiftDayLong(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: AR_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Duración del turno en minutos a partir de dos ISO (con zona). Devuelve null
 * si falta un extremo, alguno es inválido, o el fin no es posterior al inicio
 * — así el llamador no muestra "0 min" ni duraciones negativas.
 */
export function shiftDurationMinutes(startIso: string, endIso: string): number | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / 60_000);
}

/** Duración legible en español: "6 h", "6 h 30 min", "1 día 4 h". */
export function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  if (hours > 0) parts.push(`${hours} h`);
  if (mins > 0) parts.push(`${mins} min`);
  return parts.join(" ") || "0 min";
}

/** ¿Este ISO cae hoy, en el día de Argentina? Compara fechas "YYYY-MM-DD"
 * (formato `en-CA`, mismo truco que `argentinaISOToLocalInput`) en vez de
 * timestamps — evita el desfasaje de comparar contra la medianoche UTC. */
export function isTodayInArgentina(iso: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: AR_TIMEZONE });
  return fmt.format(new Date(iso)) === fmt.format(new Date());
}

/**
 * "hace 2 min" / "hace 1 h 10" / "recién". Antes vivía duplicada como
 * `agoLabel` sólo en `EnRouteMap.tsx` ("va en camino"); ahora la usa también
 * "Disponible ahora" (ADR-0014) — segundo uso real, deja de justificar la
 * duplicación.
 */
export function formatAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest}`;
}

function arDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AR_TIMEZONE }).format(date);
}

function formatTime24(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: AR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/**
 * Versión compacta para tarjetas chicas (home del trabajador): "Hoy · 20:00 –
 * 23:00", "Mañana · 21:00 – 02:00", "sáb 27/9 · 20:00 – 23:00". Horas en 24 h
 * aunque el locale del runtime prefiera "p. m.": en una fila de miniaturas el
 * "08:00 p. m. a 11:00 p. m." de `formatShiftRange` no entra.
 */
export function formatShiftWhen(startIso: string, endIso: string, now: Date = new Date()): string {
  const key = arDateKey(new Date(startIso));
  let day: string;
  if (key === arDateKey(now)) {
    day = "Hoy";
  } else if (key === arDateKey(new Date(now.getTime() + 86_400_000))) {
    day = "Mañana";
  } else {
    const weekday = new Date(startIso)
      .toLocaleDateString("es-AR", { timeZone: AR_TIMEZONE, weekday: "short" })
      .replace(".", "");
    const dayMonth = new Date(startIso).toLocaleDateString("es-AR", {
      timeZone: AR_TIMEZONE,
      day: "numeric",
      month: "numeric",
    });
    day = `${weekday} ${dayMonth}`;
  }
  return `${day} · ${formatTime24(startIso)} – ${formatTime24(endIso)}`;
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
