import type { Shift } from "@/lib/types";

/**
 * Imagen grande de un turno (hero de las tarjetas y del detalle): la foto del
 * local si el comercio la subió; si no, su logo (lo que se usaba antes); si
 * tampoco, `null` y la tarjeta cae al tono del rubro. Los AVATARES siguen
 * usando el logo directo — la foto del salón a 32px no se reconoce.
 */
export function shiftHeroPhoto(
  shift: Partial<Pick<Shift, "company_logo_url" | "company_cover_url">>
): string | null {
  return shift.company_cover_url || shift.company_logo_url || null;
}
