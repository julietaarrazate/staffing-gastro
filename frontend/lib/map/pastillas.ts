/**
 * El nombre del local al lado del pin (zoom 15 o más, 2026-11-21).
 *
 * La pastilla sale a la derecha del pin; si ahí no entra (borde de la
 * pantalla) se voltea a la izquierda; si no entra en ningún lado se achica al
 * lugar que hay (hasta un mínimo) y, si ni así, no se muestra. Si dos
 * pastillas se pisan, queda la del pin elegido y después la de los demás en
 * el orden que llegan (el más cercano primero): la que quedaría debajo se
 * oculta. Es a propósito simple: se mide con anchos ESTIMADOS por cantidad de
 * letras (no se mide el DOM) y sólo se compara pastilla contra pastilla, no
 * contra los otros pines.
 */
export const PASTILLA_MAX = 140;
export const PASTILLA_MIN = 56;
const HUECO = 4; // entre el pin y la pastilla
const MARGEN = 6; // del borde de la pantalla
const ALTO_PASTILLA = 24;
const PASTILLA_ABAJO = 6; // la pastilla sube 6 px sobre el pie del pin

export type LadoPastilla = "derecha" | "izquierda";

export interface Colocacion {
  lado: LadoPastilla;
  /** Ancho máximo que se le deja (px): el tope de 140 o el lugar que hay de ese lado, el menor. */
  ancho: number;
}

/** Ancho estimado de la pastilla: 9 px de aire a cada lado y ~7 px por letra (12 px, negrita). */
export function anchoEstimadoPastilla(nombre: string): number {
  return Math.min(PASTILLA_MAX, Math.round(18 + nombre.length * 7));
}

/** Ancho estimado del pin: aire, ícono del rubro, pago (y flechita). */
export function anchoEstimadoPin(pago: string, pagaMas: boolean): number {
  return Math.round(24 + 15 + 4 + pago.length * 8.2 + (pagaMas ? 14 : 0));
}

/** De qué lado va la pastilla de UN pin, sin mirar a las demás. `null` = no entra. */
export function ladoDePastilla(args: {
  /** x del pie del pin en el mapa (px). */
  pinX: number;
  pinAncho: number;
  pastilla: number;
  /** Ancho visible del mapa (px). */
  mapaAncho: number;
}): Colocacion | null {
  const { pinX, pinAncho, pastilla, mapaAncho } = args;
  const derecha = mapaAncho - MARGEN - (pinX + pinAncho / 2 + HUECO);
  const izquierda = pinX - pinAncho / 2 - HUECO - MARGEN;
  // El ancho que se le deja es el lugar de ese lado (hasta 140), no el estimado:
  // el estimado sólo decide el lado, y un nombre que mide un poco más que lo
  // estimado no se corta de más.
  const dejar = (lado: LadoPastilla, lugar: number): Colocacion => ({ lado, ancho: Math.min(PASTILLA_MAX, Math.floor(lugar)) });
  if (pastilla <= derecha) return dejar("derecha", derecha);
  if (pastilla <= izquierda) return dejar("izquierda", izquierda);
  const lado: LadoPastilla = derecha >= izquierda ? "derecha" : "izquierda";
  const col = dejar(lado, lado === "derecha" ? derecha : izquierda);
  return col.ancho >= PASTILLA_MIN ? col : null;
}

export interface PinParaPastilla {
  id: string;
  nombre: string | null | undefined;
  x: number;
  y: number;
  pinAncho: number;
}

interface Caja {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function pisa(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * Dónde va la pastilla de cada pin (por id); los que no aparecen no la llevan.
 * `elegidoId` va primero; el resto, en el orden recibido.
 */
export function colocarPastillas(
  pines: PinParaPastilla[],
  mapaAncho: number,
  elegidoId: string | null
): Map<string, Colocacion> {
  const orden = [...pines].sort((a, b) => Number(b.id === elegidoId) - Number(a.id === elegidoId));
  const puestas: Caja[] = [];
  const resultado = new Map<string, Colocacion>();
  for (const p of orden) {
    if (!p.nombre) continue;
    const col = ladoDePastilla({
      pinX: p.x,
      pinAncho: p.pinAncho,
      pastilla: anchoEstimadoPastilla(p.nombre),
      mapaAncho,
    });
    if (!col) continue;
    const ancho = Math.min(col.ancho, anchoEstimadoPastilla(p.nombre));
    const x0 = col.lado === "derecha" ? p.x + p.pinAncho / 2 + HUECO : p.x - p.pinAncho / 2 - HUECO - ancho;
    const caja: Caja = {
      x0,
      x1: x0 + ancho,
      y0: p.y - PASTILLA_ABAJO - ALTO_PASTILLA,
      y1: p.y - PASTILLA_ABAJO,
    };
    if (puestas.some((o) => pisa(o, caja))) continue;
    puestas.push(caja);
    resultado.set(p.id, col);
  }
  return resultado;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Posición en pantalla (px, desde la esquina de arriba a la izquierda del mapa)
 * de un punto, a partir del encuadre [oeste, sur, este, norte]. El mapa no gira
 * ni se inclina, así que alcanza con una regla de tres (lineal en la longitud,
 * Mercator en la latitud).
 */
export function proyectarEnEncuadre(
  bbox: [number, number, number, number],
  ancho: number,
  alto: number,
  lng: number,
  lat: number
): { x: number; y: number } {
  const [oeste, sur, este, norte] = bbox;
  const yNorte = mercatorY(norte);
  const ySur = mercatorY(sur);
  return {
    x: ((lng - oeste) / (este - oeste)) * ancho,
    y: ((yNorte - mercatorY(lat)) / (yNorte - ySur)) * alto,
  };
}
