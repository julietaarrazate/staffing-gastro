import type { TicketCategory } from "@/lib/types";

/**
 * U110: «Reportar un problema» desde un turno o un comercio abre `/support`
 * con el formulario de ticket nuevo precargado. El enlace lleva la categoría y
 * el id (`?categoria=turno&turno=<id>` o `?categoria=comercio&comercio=<id>`).
 * El id sólo se usa para pedirle al backend qué se va a atar; quien decide si
 * la persona puede atarlo es el servidor (ajeno o inexistente = 404).
 */

// Mismo formato que un UUID de Postgres: cualquier otra cosa en la URL se
// ignora (no se manda al backend un texto armado a mano).
const ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SupportPrefill = {
  category: Extract<TicketCategory, "turno" | "comercio">;
  shiftId: string | null;
  companyId: string | null;
};

export function reportShiftHref(shiftId: string): string {
  return `/support?categoria=turno&turno=${encodeURIComponent(shiftId)}`;
}

export function reportCompanyHref(companyId: string): string {
  return `/support?categoria=comercio&comercio=${encodeURIComponent(companyId)}`;
}

type ParamReader = { get(name: string): string | null };

/** Lo que trae la URL de `/support`, o `null` si no hay nada que precargar. */
export function parseSupportPrefill(params: ParamReader): SupportPrefill | null {
  const shift = params.get("turno");
  const company = params.get("comercio");
  const shiftId = shift && ID_SHAPE.test(shift) ? shift : null;
  const companyId = company && ID_SHAPE.test(company) ? company : null;
  const category = params.get("categoria");
  if (category === "turno" && shiftId) return { category: "turno", shiftId, companyId: null };
  if (category === "comercio" && companyId) {
    return { category: "comercio", shiftId: null, companyId };
  }
  return null;
}
