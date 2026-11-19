import type { Route } from "@playwright/test";
import respuestas from "./contrato/respuestas.json";

/**
 * Mocks armados con respuestas REALES del backend.
 *
 * `e2e/contrato/respuestas.json` lo escribe `backend/tests/test_contrato_frontend.py`
 * recorriendo escenarios contra la app de verdad (ver `e2e/contrato/README.md`).
 * Un spec que arma la respuesta de un turno, de la sesión o de un error con esto
 * no puede inventar un campo que el backend no manda ni mandar un status que
 * el servidor no manda para ese caso.
 */

export type NombreRespuesta = keyof typeof respuestas;
export type Cuerpo<N extends NombreRespuesta> = (typeof respuestas)[N]["body"];

type Json = unknown;
type Objeto = Record<string, Json>;

const esObjeto = (v: Json): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

function real(nombre: NombreRespuesta): { status: number; body: Json } {
  const r = (respuestas as Record<string, { status: number; body: Json }>)[nombre];
  if (!r) throw new Error(`contrato: no hay una respuesta real llamada "${nombre}"`);
  return r;
}

/** Status que el backend mandó en ese escenario. */
export function statusDe(nombre: NombreRespuesta): number {
  return real(nombre).status;
}

/** Cuerpo real (copia profunda: se puede modificar sin tocar el contrato). */
export function respuesta<N extends NombreRespuesta>(nombre: N): Cuerpo<N> {
  return structuredClone(real(nombre).body) as Cuerpo<N>;
}

function fundir(base: Json, cambio: Json, ruta: string, nombre: string): Json {
  if (Array.isArray(cambio)) {
    // Cada elemento se funde sobre el primero de la lista real (si es un objeto):
    // sirve para armar «tres turnos» a partir de uno real, y valida las claves.
    const molde = Array.isArray(base) ? base[0] : undefined;
    return cambio.map((c, i) =>
      esObjeto(molde) && esObjeto(c)
        ? fundir(structuredClone(molde), c, `${ruta}[${i}]`, nombre)
        : c
    );
  }
  if (esObjeto(cambio)) {
    // Si lo real es null o una lista vacía no hay con qué validar: se acepta.
    if (!esObjeto(base)) return cambio;
    const out: Objeto = { ...base };
    for (const [clave, valor] of Object.entries(cambio)) {
      const donde = ruta ? `${ruta}.${clave}` : clave;
      if (!(clave in base)) {
        throw new Error(
          `deContrato("${nombre}"): la clave "${donde}" no existe en la respuesta real del backend. ` +
            `Claves reales${ruta ? ` de ${ruta}` : ""}: ${Object.keys(base).join(", ")}.`
        );
      }
      out[clave] = fundir(base[clave], valor, donde, nombre);
    }
    return out;
  }
  return cambio;
}

/**
 * Respuesta real con `cambios` encima. Tira error si un cambio agrega una clave
 * (también anidada) que la respuesta real no tiene. En una lista, cada elemento
 * de `cambios` se aplica sobre el primer elemento real.
 */
export function deContrato<N extends NombreRespuesta>(
  nombre: N,
  cambios?: Objeto | Json[]
): Cuerpo<N> {
  const base = respuesta(nombre);
  if (cambios === undefined) return base;
  return fundir(base, cambios, "", nombre) as Cuerpo<N>;
}

/** Opciones de `route.fulfill` (status real, JSON) para guardar en una constante. */
export function opcionesDeContrato(
  nombre: NombreRespuesta,
  cambios?: Objeto | Json[]
): { status: number; contentType: string; body: string } {
  return {
    status: statusDe(nombre),
    contentType: "application/json",
    body: JSON.stringify(deContrato(nombre, cambios)),
  };
}

/** `route.fulfill` con el status real del escenario y el cuerpo (con cambios). */
export function fulfillContrato(
  route: Route,
  nombre: NombreRespuesta,
  cambios?: Objeto | Json[]
) {
  return route.fulfill(opcionesDeContrato(nombre, cambios));
}
