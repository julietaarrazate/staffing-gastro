import { AR_TIMEZONE } from "@/lib/datetime";

/**
 * La semana en curso (de lunes a domingo, en el día de Argentina) para la
 * tira del cielo de Mis turnos: qué día es hoy y en cuáles hay un turno.
 */
export interface DiaSemana {
  /** "YYYY-MM-DD" en Argentina. */
  clave: string;
  /** "lun", "mar"… */
  corto: string;
  /** "lunes", "martes"… (para lectores de pantalla). */
  largo: string;
  numero: number;
  esHoy: boolean;
}

const CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

const CLAVE = new Intl.DateTimeFormat("en-CA", { timeZone: AR_TIMEZONE });

/** El día de Argentina de un instante, como "YYYY-MM-DD". */
export function claveDiaArgentina(fecha: Date | string): string {
  return CLAVE.format(typeof fecha === "string" ? new Date(fecha) : fecha);
}

/** Los siete días (lunes a domingo) de la semana de `ahora` en Argentina. */
export function semanaArgentina(ahora: Date = new Date()): DiaSemana[] {
  const hoy = claveDiaArgentina(ahora);
  const [y, m, d] = hoy.split("-").map(Number);
  // Al mediodía UTC: sumar días no cruza ningún cambio de fecha.
  const base = Date.UTC(y, m - 1, d, 12);
  const desdeLunes = (new Date(base).getUTCDay() + 6) % 7;
  return CORTOS.map((corto, i) => {
    const dia = new Date(base + (i - desdeLunes) * 86_400_000);
    const clave = dia.toISOString().slice(0, 10);
    return { clave, corto, largo: LARGOS[i], numero: dia.getUTCDate(), esHoy: clave === hoy };
  });
}

/** El día de un turno para el bloque de fecha de su fila: «sáb» y «21». */
export function diaCortoArgentina(iso: string): { corto: string; numero: number } {
  const [y, m, d] = claveDiaArgentina(iso).split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d, 12));
  return { corto: CORTOS[(dia.getUTCDay() + 6) % 7], numero: d };
}
