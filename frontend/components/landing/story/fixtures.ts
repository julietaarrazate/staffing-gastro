import type { CandidateMatch, Shift, ShiftStatus } from "@/lib/types";

/**
 * Datos de la historia de la landing: UN turno, el de mozo de 21 a 2 de un
 * viernes en Palermo, desde que se cae (20:46) hasta que queda cubierto.
 *
 * Todo es ilustrativo y la página lo dice ("Historia ilustrativa"). El local
 * se llama "Tu bar" a propósito: el visitante ES el comercio, y así no se
 * nombra un negocio real sin su permiso (los ejemplos viejos usaban "Bar
 * Uriarte", que existe). Martín y Lucía son nombres de pila de ejemplo.
 *
 * Los números que SÍ son del producto: el aviso a los 10 más indicados
 * (`NEARBY_NOTIFICATION_LIMIT`, backend/app/modules/shift/application/
 * services.py), el pago por hora junto al total (ADR-0012) y el objetivo de
 * cubrir un turno en menos de 10 minutos (PRODUCT.md), que es un objetivo y
 * no un promedio medido.
 */

export const LOCAL = "Tu bar";
export const BARRIO = "Palermo";

/** Fecha fija para el HTML del servidor: con una fecha relativa a "hoy", el
 *  prerender y el navegador podían dar textos distintos (error de
 *  hidratación). Después de montar se reemplaza por hoy (`withToday`). */
const FIXED_START = "2026-10-09T21:00:00-03:00";
const FIXED_END = "2026-10-10T02:00:00-03:00";

export function storyShift(status: ShiftStatus = "publicado", overrides: Partial<Shift> = {}): Shift {
  return {
    id: "historia",
    company_id: "historia",
    position: "mozo",
    quantity: 1,
    start_at: FIXED_START,
    end_at: FIXED_END,
    pay_amount: "70000",
    currency: "ARS",
    tips: true,
    meal: true,
    dress_code: null,
    urgent: false,
    address: null,
    city: BARRIO,
    // Sin coordenadas a propósito: ShiftCard y OpportunityCard cargan MapLibre
    // (WebGL, tiles remotos) cuando las tienen. El mapa de la historia es SVG.
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status,
    worker_profile_id: status === "publicado" ? null : "lucia",
    en_route_latitude: null,
    en_route_longitude: null,
    en_route_at: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    no_show_at: null,
    last_no_show_worker_profile_id: null,
    event_id: null,
    event_name: null,
    created_at: null,
    company_name: LOCAL,
    company_logo_url: null,
    worker_name: "Lucía",
    pay_band: null,
    company_verified: false,
    ...overrides,
  };
}

/** El mismo turno con fecha de hoy a las 21 (hora de Argentina), para que la
 *  tarjeta diga "Hoy · 21:00 – 02:00". Sólo en el navegador, después de
 *  montar. */
export function withToday(shift: Shift, now: Date = new Date()): Shift {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const start = new Date(`${ymd}T21:00:00-03:00`);
  const end = new Date(start.getTime() + 5 * 3_600_000);
  return { ...shift, start_at: start.toISOString(), end_at: end.toISOString() };
}

function candidate(input: Partial<CandidateMatch> & Pick<CandidateMatch, "profile_id" | "full_name">): CandidateMatch {
  return {
    user_id: input.profile_id,
    photo_url: null,
    rating: 0,
    score: 0,
    distance_km: null,
    events_completed: 0,
    punctuality_rate: 0,
    years_experience: 0,
    badges: [],
    level: "bronce",
    identidad_verificada: false,
    ...input,
  };
}

/** El ranking que ve Tu bar. El orden ES el ranking (distancia, reputación,
 *  experiencia, puntualidad), y hay una persona nueva a propósito: le dice al
 *  trabajador que recién llega que también tiene lugar. */
export const CANDIDATES: CandidateMatch[] = [
  candidate({
    profile_id: "lucia",
    full_name: "Lucía M.",
    rating: 4.9,
    score: 0.91,
    distance_km: 0.6,
    events_completed: 23,
    punctuality_rate: 0.96,
    years_experience: 4,
    identidad_verificada: true,
  }),
  candidate({
    profile_id: "diego",
    full_name: "Diego R.",
    rating: 4.7,
    score: 0.78,
    distance_km: 1.9,
    events_completed: 12,
    punctuality_rate: 0.92,
    years_experience: 6,
    identidad_verificada: true,
  }),
  candidate({
    profile_id: "camila",
    full_name: "Camila P.",
    score: 0.64,
    distance_km: 1.1,
    years_experience: 2,
    identidad_verificada: true,
  }),
];

/** Lo que el comercio escribe en "Describilo y lo completamos". */
export const PEDIDO = "Necesito un mozo hoy de 21 a 2, pago 70.000";

/** Las tres partes de la frase que se convierten en campos del turno. */
export const PEDIDO_PARTES = [
  { texto: "mozo", campo: "puesto" },
  { texto: "hoy de 21 a 2", campo: "horario" },
  { texto: "70.000", campo: "pago" },
] as const;

/**
 * El reloj del turno: la línea que acompaña toda la historia. Avanza un
 * minuto sólo cuando alguien hace algo, y se queda quieto en CUBIERTO.
 * El registro del final repite esta misma lista.
 */
export const RELOJ = {
  sinCubrir: { hora: "20:46", estado: "Sin cubrir" },
  pidiendo: { hora: "20:47", estado: "Sin cubrir" },
  publicado: { hora: "20:48", estado: "Publicado" },
  avisado: { hora: "20:48", estado: "Avisado a 10" },
  postulante: { hora: "20:49", estado: "1 postulante" },
  postulantes: { hora: "20:51", estado: "3 postulantes" },
  asignado: { hora: "20:53", estado: "Asignado" },
  cubierto: { hora: "20:54", estado: "Cubierto" },
  enCamino: { hora: "20:54", estado: "En camino" },
  llego: { hora: "20:54", estado: "Llegó" },
} as const;

export type RelojKey = keyof typeof RELOJ;

/** El registro del turno que cierra la historia (RESULTADO). */
export const REGISTRO = [
  { hora: "20:46", texto: "Martín avisa que no llega" },
  { hora: "20:48", texto: "Publicado" },
  { hora: "20:48", texto: "Avisado a 10 cerca" },
  { hora: "20:51", texto: "3 postulantes" },
  { hora: "20:53", texto: "Asignado a Lucía" },
  { hora: "20:54", texto: "Lucía confirma" },
  { hora: "20:58", texto: "Llegó" },
  { hora: "02:00", texto: "Turno terminado" },
  { hora: "02:05", texto: "Se califican los dos" },
] as const;

/**
 * El mapa de la historia, en unidades de un cuadrado de 100×100 con el local
 * en el centro. Escala de referencia: 25 unidades ≈ 1 km, así las distancias
 * de los candidatos coinciden con lo que dicen sus tarjetas. Las posiciones
 * son inventadas y la escena dice "Ubicaciones aproximadas".
 */
export const MAP_LOCAL = { x: 50, y: 50 } as const;

export type MapWorker = { id: string; inicial: string; x: number; y: number; candidato?: boolean; rating?: number };

export const MAP_WORKERS: MapWorker[] = [
  { id: "lucia", inicial: "L", x: 61, y: 39, candidato: true, rating: 4.9 },
  { id: "camila", inicial: "C", x: 27, y: 61, candidato: true },
  { id: "diego", inicial: "D", x: 82, y: 82, candidato: true, rating: 4.7 },
  { id: "w4", inicial: "S", x: 34, y: 33 },
  { id: "w5", inicial: "J", x: 72, y: 58 },
  { id: "w6", inicial: "M", x: 47, y: 74 },
  { id: "w7", inicial: "A", x: 22, y: 42 },
  { id: "w8", inicial: "R", x: 78, y: 26 },
  { id: "w9", inicial: "T", x: 15, y: 80 },
  { id: "w10", inicial: "F", x: 58, y: 13 },
];

/** Distancia al local, en unidades del mapa. */
export function mapDistance(w: { x: number; y: number }): number {
  return Math.hypot(w.x - MAP_LOCAL.x, w.y - MAP_LOCAL.y);
}
