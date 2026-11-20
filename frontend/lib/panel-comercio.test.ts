import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { familyOf, resumenPanel } from "./panel-comercio";

// Mediodía en Buenos Aires.
const AHORA = new Date("2026-11-20T15:00:00Z");
const HOY = "2026-11-20T21:00:00-03:00";
const MANANA = "2026-11-21T21:00:00-03:00";

function turno(id: string, status: Shift["status"], extra: Partial<Shift> = {}): Shift {
  return { id, status, start_at: HOY, end_at: HOY, ...extra } as Shift;
}

describe("familyOf", () => {
  it("confirmado sigue en marcha y no cubierto va con los cancelados", () => {
    expect(familyOf("confirmado")).toBe("en_marcha");
    expect(familyOf("no_cubierto")).toBe("cancelado");
    expect(familyOf("publicado")).toBe("buscando");
  });
});

describe("resumenPanel", () => {
  it("sin turnos en curso el cielo no está en marcha, aunque haya historia", () => {
    const r = resumenPanel([turno("a", "pagado"), turno("b", "cancelado"), turno("c", "borrador")], AHORA);
    expect(r.enMarcha).toBe(false);
    expect(r.elegir).toBeNull();
    expect(r.nadie).toBeNull();
  });

  it("cuenta los turnos de hoy con sus tres estados; borradores y cancelados no cuentan", () => {
    const r = resumenPanel(
      [
        turno("a", "publicado"),
        turno("b", "confirmado"),
        turno("c", "finalizado"),
        turno("d", "cancelado"),
        turno("e", "borrador"),
        turno("f", "publicado", { start_at: MANANA }),
      ],
      AHORA
    );
    expect(r).toMatchObject({ enMarcha: true, deHoy: true, total: 3, buscando: 1, cubiertos: 1, terminados: 1, marchando: true });
  });

  it("si hoy no queda nada en curso, cuenta los que están en curso otros días", () => {
    const r = resumenPanel(
      [turno("a", "pagado"), turno("b", "publicado", { start_at: MANANA }), turno("c", "asignado", { start_at: MANANA })],
      AHORA
    );
    expect(r).toMatchObject({ enMarcha: true, deHoy: false, total: 2, buscando: 1, cubiertos: 1, terminados: 0 });
  });

  it("elegir: el turno con postulaciones pendientes que empieza antes", () => {
    const r = resumenPanel(
      [
        turno("tarde", "publicado", { start_at: MANANA, pending_applicants_count: 5 }),
        turno("sin", "publicado", { pending_applicants_count: 0 }),
        turno("antes", "buscando_personal", { pending_applicants_count: 2 }),
        turno("asignado", "asignado", { pending_applicants_count: 3 }),
      ],
      AHORA
    );
    expect(r.elegir?.id).toBe("antes");
    expect(r.nadie).toBeNull();
  });

  it("nadie: hay turnos buscando y ninguno tiene postulaciones (o no llegó el dato)", () => {
    const r = resumenPanel(
      [turno("b", "publicado", { start_at: MANANA, pending_applicants_count: null }), turno("a", "publicado", { pending_applicants_count: 0 })],
      AHORA
    );
    expect(r.elegir).toBeNull();
    expect(r.nadie?.id).toBe("a");
    expect(r.marchando).toBe(true);
  });

  it("con todo cubierto no late «Marchando» ni hay a quién elegir", () => {
    const r = resumenPanel([turno("a", "confirmado")], AHORA);
    expect(r).toMatchObject({ enMarcha: true, marchando: false, elegir: null, nadie: null });
  });
});
