import { AR_TIMEZONE } from "@/lib/datetime";

/**
 * Edad mínima para crear una cuenta (U101, decisión de Julieta del
 * 2026-11-17). Espeja `backend/app/modules/identity/domain/edad.py`: el
 * backend es quien decide; acá sólo se avisa antes de mandar el formulario.
 */
export const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 100;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Hoy en Argentina como `AAAA-MM-DD` (lo que cuenta para un cumpleaños). */
export function hoyArgentina(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function partes(fecha: string): [number, number, number] | null {
  const m = FECHA.exec(fecha);
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(a, mes - 1, d));
  if (real.getUTCFullYear() !== a || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== d) return null;
  return [a, mes, d];
}

/** Años cumplidos a `hoy` (las dos fechas `AAAA-MM-DD`). */
export function edadEn(nacimiento: string, hoy: string): number | null {
  const n = partes(nacimiento);
  const h = partes(hoy);
  if (!n || !h) return null;
  const antesDelCumple = h[1] < n[1] || (h[1] === n[1] && h[2] < n[2]);
  return h[0] - n[0] - (antesDelCumple ? 1 : 0);
}

/** Por qué la fecha de nacimiento no alcanza para crear la cuenta, o `null`
 * si está bien. Los textos son los mismos que responde el backend. */
export function motivoFechaNacimiento(nacimiento: string, hoy: string = hoyArgentina()): string | null {
  if (nacimiento.trim() === "") return "Escribí tu fecha de nacimiento para seguir.";
  const edad = edadEn(nacimiento, hoy);
  if (edad === null || nacimiento > hoy || edad > EDAD_MAXIMA) return "Revisá tu fecha de nacimiento.";
  if (edad < EDAD_MINIMA) return `Oído es sólo para mayores de ${EDAD_MINIMA} años.`;
  return null;
}

/** La fecha más reciente que se puede elegir (cumplir 18 hoy), para el `max`
 * del campo. Quien cumple un 29 de febrero se toma el 28 en los años que no
 * son bisiestos, así el selector nunca propone una fecha que no existe. */
export function nacimientoMasReciente(hoy: string = hoyArgentina()): string {
  const [a, m, d] = hoy.split("-");
  const candidata = `${Number(a) - EDAD_MINIMA}-${m}-${d}`;
  return partes(candidata) ? candidata : `${Number(a) - EDAD_MINIMA}-${m}-28`;
}
