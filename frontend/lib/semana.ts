import { AR_TIMEZONE } from "@/lib/datetime";

/**
 * Las semanas (de lunes a domingo, en el día de Argentina) para la tira del
 * cielo, que usan Mis turnos y el Panel del comercio: qué día es hoy, cuál es
 * la semana que se ve y en cuáles hay un turno. Todo trabaja con claves
 * "YYYY-MM-DD" del día de Argentina; nunca con el día de la zona del
 * navegador.
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

/**
 * El día en que se muestra un turno en la tira (Mis turnos y el Panel): el de
 * su inicio, salvo que esté en curso ahora (empezó y todavía no terminó), que
 * se muestra hoy. Sin esto, un turno de 21 a 3 que cruza la medianoche del
 * domingo quedaba en la semana anterior y desaparecía de la vista justo
 * mientras se trabaja (2026-11-21).
 */
export function claveDeVista(turno: { start_at: string; end_at?: string | null }, ahora: Date = new Date()): string {
  const t = ahora.getTime();
  if (turno.end_at && new Date(turno.start_at).getTime() <= t && t < new Date(turno.end_at).getTime()) {
    return claveDiaArgentina(ahora);
  }
  return claveDiaArgentina(turno.start_at);
}

const DIA_MS = 86_400_000;

/** Mediodía UTC de una clave: sumar días no cruza ningún cambio de fecha. */
const mediodia = (clave: string) => {
  const [y, m, d] = clave.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
};
/** 0 = lunes … 6 = domingo. */
const desdeLunes = (t: number) => (new Date(t).getUTCDay() + 6) % 7;

/**
 * Los siete días (lunes a domingo) de la semana de `ahora` en Argentina;
 * `semanas` la corre hacia adelante (positivo) o hacia atrás (negativo).
 */
export function semanaArgentina(ahora: Date = new Date(), semanas = 0): DiaSemana[] {
  const hoy = claveDiaArgentina(ahora);
  const base = mediodia(hoy) + semanas * 7 * DIA_MS;
  const atras = desdeLunes(base);
  return CORTOS.map((corto, i) => {
    const dia = new Date(base + (i - atras) * DIA_MS);
    const clave = dia.toISOString().slice(0, 10);
    return { clave, corto, largo: LARGOS[i], numero: dia.getUTCDate(), esHoy: clave === hoy };
  });
}

/** El día de un turno para el bloque de fecha de su fila: «sáb» y «21». */
export function diaCortoArgentina(iso: string): { corto: string; numero: number } {
  const clave = claveDiaArgentina(iso);
  return { corto: CORTOS[desdeLunes(mediodia(clave))], numero: Number(clave.slice(8)) };
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const mesDe = (clave: string) => MESES[Number(clave.slice(5, 7)) - 1];

/** «16 – 22 nov» (o «30 nov – 6 dic» si la semana cruza de mes, o de año: «28 dic – 3 ene»). */
export function rotuloSemana(dias: DiaSemana[]): string {
  const a = dias[0];
  const b = dias[dias.length - 1];
  return mesDe(a.clave) === mesDe(b.clave)
    ? `${a.numero} – ${b.numero} ${mesDe(b.clave)}`
    : `${a.numero} ${mesDe(a.clave)} – ${b.numero} ${mesDe(b.clave)}`;
}

/** «martes 17», para el aviso de un día sin turnos («Nada el martes 17»). */
export function diaEnPalabras(clave: string): string {
  return `${LARGOS[desdeLunes(mediodia(clave))]} ${Number(clave.slice(8))}`;
}

/** «lun 23 nov»: la fecha corta de una fila de «Más adelante». */
export function fechaCorta(clave: string): string {
  return `${CORTOS[desdeLunes(mediodia(clave))]} ${Number(clave.slice(8))} ${mesDe(clave)}`;
}

/** Cuántas semanas (de lunes a lunes) separan el día `clave` de la semana de `ahora`. */
export function semanasHasta(clave: string, ahora: Date = new Date()): number {
  const lunes = (c: string) => mediodia(c) - desdeLunes(mediodia(c)) * DIA_MS;
  return Math.round((lunes(clave) - lunes(claveDiaArgentina(ahora))) / (7 * DIA_MS));
}

/** Cuántos turnos hay por día: de las claves de sus días a un conteo. */
export function turnosPorDia(claves: Iterable<string>): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const c of claves) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  return cuenta;
}
