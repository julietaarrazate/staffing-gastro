import { describe, expect, it } from "vitest";
import type { Shift, ShiftStatus } from "@/lib/types";
import { nextStepFor } from "./shift-next-step";

// Sólo se lee `shift.status` — el cast evita tener que armar un Shift
// completo por cada caso (intencional, no un atajo por descuido).
function withStatus(status: ShiftStatus): Shift {
  return { status } as Shift;
}

describe("nextStepFor", () => {
  it("borrador y publicado/buscando_personal apuntan a la acción del comercio", () => {
    expect(nextStepFor(withStatus("borrador")).action).toBe("publish");
    expect(nextStepFor(withStatus("publicado")).action).toBe("candidates");
    expect(nextStepFor(withStatus("buscando_personal")).action).toBe("candidates");
  });

  it("mientras la pelota está del lado del trabajador, el comercio no tiene acción", () => {
    for (const status of ["asignado", "confirmado", "en_camino", "check_in", "trabajando"] as const) {
      expect(nextStepFor(withStatus(status)).action).toBeNull();
      // Pero sí tiene que haber SIEMPRE una explicación de qué está pasando.
      expect(nextStepFor(withStatus(status)).hint).not.toBe("");
    }
  });

  it("check_out pide cerrar el turno, finalizado pide marcar como pagado", () => {
    expect(nextStepFor(withStatus("check_out")).action).toBe("finish");
    expect(nextStepFor(withStatus("finalizado")).action).toBe("markPaid");
  });

  it("pagado y cancelado son estados terminales sin acción pendiente", () => {
    expect(nextStepFor(withStatus("pagado")).action).toBeNull();
    expect(nextStepFor(withStatus("cancelado")).action).toBeNull();
  });

  it("todo estado con acción trae también su actionLabel (no queda un botón sin texto)", () => {
    const withAction: ShiftStatus[] = [
      "borrador",
      "publicado",
      "buscando_personal",
      "check_out",
      "finalizado",
    ];
    for (const status of withAction) {
      expect(nextStepFor(withStatus(status)).actionLabel).toBeTruthy();
    }
  });

  it("un status desconocido no rompe: cae al fallback sin acción", () => {
    expect(nextStepFor(withStatus("algo_que_no_existe" as ShiftStatus))).toEqual({
      hint: "",
      action: null,
    });
  });
});
