import { describe, expect, it } from "vitest";
import type { ApplicationStatus } from "@/lib/types";
import { appliedShiftIds } from "./applications";

function application(shift_id: string, status: ApplicationStatus) {
  return { shift_id, status };
}

describe("appliedShiftIds", () => {
  it("cuenta como postulado mientras la postulación está pendiente o aceptada", () => {
    const ids = appliedShiftIds([application("turno-1", "pendiente"), application("turno-2", "aceptada")]);
    expect([...ids].sort()).toEqual(["turno-1", "turno-2"]);
  });

  it("una postulación retirada ya no cuenta: el turno vuelve a ofrecerse", () => {
    const ids = appliedShiftIds([application("turno-1", "retirada"), application("turno-2", "pendiente")]);
    expect(ids.has("turno-1")).toBe(false);
    expect(ids.has("turno-2")).toBe(true);
  });

  it("una postulación rechazada tampoco cuenta como estar postulado", () => {
    expect(appliedShiftIds([application("turno-1", "rechazada")]).has("turno-1")).toBe(false);
  });

  it("sin postulaciones no hay turnos postulados", () => {
    expect(appliedShiftIds([]).size).toBe(0);
  });
});
