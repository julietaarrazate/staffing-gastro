import { WORKER_SKILLS, type WorkerSkill } from "@/lib/types";
import {
  PREFIJO_BORRADOR,
  borrarSesion,
  guardarSesion,
  leerSesion,
} from "@/lib/almacen-sesion";

/**
 * Borrador del asistente de publicar (`/shifts/new`) en `sessionStorage`:
 * sobrevive a una recarga y se borra al publicar y al cerrar sesión. Guarda el
 * formulario, qué campos tocó la persona a mano (la IA no los pisa) y el
 * estado del pedido de publicar (borrador ya creado en el servidor y pedido
 * pendiente), para no repetirlo ni duplicar el turno (BK-7DCC7E4AB945).
 */
export const CLAVE_BORRADOR_TURNO = `${PREFIJO_BORRADOR}publicar-turno`;
/** Keys de idempotencia del mismo intento (ver `useIdempotencyKeys`). */
export const CLAVE_KEYS_TURNO = `${PREFIJO_BORRADOR}publicar-turno:keys`;

export type CampoTurno =
  | "position"
  | "startAt"
  | "endAt"
  | "payAmount"
  | "tips"
  | "meal"
  | "urgent"
  | "dressCode"
  | "place";

/** La idempotencia del backend dura 24 h: pasadas 12 h el intento se descarta. */
export const VIGENCIA_INTENTO_MS = 12 * 60 * 60 * 1000;

export interface BorradorTurno {
  /** Cuenta dueña: un borrador ajeno no se usa. */
  owner: string | null;
  position: WorkerSkill | null;
  startAt: string;
  endAt: string;
  payAmount: string;
  tips: boolean;
  meal: boolean;
  urgent: boolean;
  dressCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  describeText: string;
  tocados: CampoTurno[];
  /** Borrador ya creado en el servidor y lo que tiene guardado. */
  servidor: { id: string; saved: string | null } | null;
  /** Pedido de crear que quedó sin respuesta (se repite tal cual). */
  pendingCreate: Record<string, unknown> | null;
  /** Desde cuándo existe el intento de publicar (turno creado o pedido pendiente). */
  intentoDesde?: number | null;
}

const esTexto = (v: unknown): v is string => typeof v === "string";
const esBool = (v: unknown): v is boolean => typeof v === "boolean";
const esNumOnull = (v: unknown): v is number | null => v === null || typeof v === "number";

export function guardarBorradorTurno(b: BorradorTurno, ahora: number = Date.now()): void {
  const hayIntento = b.servidor !== null || b.pendingCreate !== null;
  const previo = leerSesion<{ intentoDesde?: unknown }>(CLAVE_BORRADOR_TURNO)?.intentoDesde;
  const intentoDesde = hayIntento ? (typeof previo === "number" ? previo : ahora) : null;
  guardarSesion(CLAVE_BORRADOR_TURNO, { ...b, intentoDesde });
}

export function borrarBorradorTurno(): void {
  borrarSesion(CLAVE_BORRADOR_TURNO);
  borrarSesion(CLAVE_KEYS_TURNO);
}

/** Lee el borrador; `null` si no hay, está corrupto o es de otra cuenta. */
export function leerBorradorTurno(
  owner: string | null,
  ahora: number = Date.now()
): BorradorTurno | null {
  const b = leerSesion<Partial<BorradorTurno>>(CLAVE_BORRADOR_TURNO);
  if (!b || typeof b !== "object") return null;
  if ((b.owner ?? null) !== owner) return null;
  const position =
    b.position == null
      ? null
      : (WORKER_SKILLS as readonly string[]).includes(b.position)
        ? b.position
        : undefined;
  if (
    position === undefined ||
    !esTexto(b.startAt) ||
    !esTexto(b.endAt) ||
    !esTexto(b.payAmount) ||
    !esBool(b.tips) ||
    !esBool(b.meal) ||
    !esBool(b.urgent) ||
    !esTexto(b.dressCode) ||
    !esTexto(b.city) ||
    !esNumOnull(b.latitude ?? null) ||
    !esNumOnull(b.longitude ?? null)
  ) {
    return null;
  }
  const servidor =
    b.servidor && esTexto(b.servidor.id)
      ? { id: b.servidor.id, saved: esTexto(b.servidor.saved) ? b.servidor.saved : null }
      : null;
  // Intento viejo (sin fecha o pasadas 12 h): la clave guardada ya puede no
  // valer en el servidor. Se conserva el formulario, no el intento.
  const desde = typeof b.intentoDesde === "number" ? b.intentoDesde : null;
  const vencido = (servidor !== null || b.pendingCreate) && (desde === null || ahora - desde > VIGENCIA_INTENTO_MS);
  if (vencido) borrarSesion(CLAVE_KEYS_TURNO);
  return {
    owner,
    position,
    startAt: b.startAt,
    endAt: b.endAt,
    payAmount: b.payAmount,
    tips: b.tips,
    meal: b.meal,
    urgent: b.urgent,
    dressCode: b.dressCode,
    city: b.city,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    describeText: esTexto(b.describeText) ? b.describeText : "",
    tocados: Array.isArray(b.tocados) ? (b.tocados.filter(esTexto) as CampoTurno[]) : [],
    servidor: vencido ? null : servidor,
    pendingCreate:
      !vencido && b.pendingCreate && typeof b.pendingCreate === "object" ? b.pendingCreate : null,
    intentoDesde: vencido ? null : desde,
  };
}

/**
 * Qué le aplica la IA a un borrador ya parseado: sólo los campos que la
 * persona no tocó. Devuelve los valores resultantes (los tocados se mantienen).
 */
export interface ValoresTurno {
  position: WorkerSkill | null;
  startAt: string;
  endAt: string;
  payAmount: string;
  tips: boolean;
  meal: boolean;
  urgent: boolean;
  dressCode: string;
}

export interface ParseadoIA {
  position: WorkerSkill | null;
  startAt: string;
  endAt: string;
  payAmount: string | null;
  tips: boolean;
  meal: boolean;
  urgent: boolean;
  dressCode: string | null;
}

export function mezclarConIA(
  actual: ValoresTurno,
  ia: ParseadoIA,
  tocados: ReadonlySet<CampoTurno>
): ValoresTurno {
  const libre = (c: CampoTurno) => !tocados.has(c);
  return {
    position: libre("position") && ia.position ? ia.position : actual.position,
    startAt: libre("startAt") && ia.startAt ? ia.startAt : actual.startAt,
    endAt: libre("endAt") && ia.endAt ? ia.endAt : actual.endAt,
    payAmount: libre("payAmount") && ia.payAmount ? ia.payAmount : actual.payAmount,
    tips: libre("tips") ? ia.tips : actual.tips,
    meal: libre("meal") ? ia.meal : actual.meal,
    urgent: libre("urgent") ? ia.urgent : actual.urgent,
    dressCode: libre("dressCode") && ia.dressCode ? ia.dressCode : actual.dressCode,
  };
}
