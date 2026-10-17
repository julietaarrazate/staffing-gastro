import { describe, expect, it } from "vitest";
import { isShareable, type ShareableShift } from "@/lib/shift-share";

const base: ShareableShift = {
  position: "mozo",
  start_at: "2026-10-20T20:00:00-03:00",
  end_at: "2026-10-21T02:00:00-03:00",
  city: "Palermo",
  pay_amount: "45000",
};

describe("isShareable", () => {
  it("un turno abierto se comparte, también si volvió a buscar gente", () => {
    expect(isShareable({ ...base, status: "publicado" })).toBe(true);
    expect(isShareable({ ...base, status: "buscando_personal" })).toBe(true);
  });

  it("un turno que ya no está abierto no: su link abriría en 'Turno no encontrado'", () => {
    for (const status of ["borrador", "asignado", "confirmado", "finalizado", "cancelado"] as const) {
      expect(isShareable({ ...base, status })).toBe(false);
    }
  });

  it("la vista pública no trae estado: sólo existe para turnos abiertos", () => {
    expect(isShareable(base)).toBe(true);
  });
});
