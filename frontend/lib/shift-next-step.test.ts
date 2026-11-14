import { describe, expect, it } from "vitest";
import type { Shift, ShiftStatus } from "@/lib/types";
import { firstNameOf, nextStepFor } from "./shift-next-step";

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

  it("publicado, buscando y cancelado no repiten en texto lo que ya dice el chip", () => {
    for (const status of ["publicado", "buscando_personal", "cancelado"] as const) {
      expect(nextStepFor(withStatus(status)).hint).toBe("");
    }
  });

  it("check_out pide cerrar el turno, finalizado pide marcar como pagado", () => {
    expect(nextStepFor(withStatus("check_out")).action).toBe("finish");
    expect(nextStepFor(withStatus("finalizado")).action).toBe("markPaid");
  });

  it("pagado, cancelado y no_cubierto son estados terminales sin acción pendiente", () => {
    expect(nextStepFor(withStatus("pagado")).action).toBeNull();
    expect(nextStepFor(withStatus("cancelado")).action).toBeNull();
    expect(nextStepFor(withStatus("no_cubierto")).action).toBeNull();
  });

  it("no_cubierto (ADR-0015) explica qué pasó sin sonar a que alguien lo canceló", () => {
    const hint = nextStepFor(withStatus("no_cubierto")).hint;
    expect(hint).not.toBe("");
    expect(hint.toLowerCase()).not.toContain("cancel");
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

describe("firstNameOf", () => {
  it("toma el primer nombre", () => {
    expect(firstNameOf("Ana María Pérez")).toBe("Ana");
    expect(firstNameOf("  Beto   Gómez ")).toBe("Beto");
  });

  it("sin nombre usable devuelve null", () => {
    for (const v of [null, undefined, "", "   ", "\n\t"]) {
      expect(firstNameOf(v)).toBeNull();
    }
  });

  it("corta con puntos suspensivos un nombre larguísimo", () => {
    const out = firstNameOf("Maximiliano".repeat(5))!;
    expect(Array.from(out).length).toBe(19);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("nextStepFor con nombre y cantidad", () => {
  const shift = (extra: Partial<Shift>): Shift => ({ ...extra }) as Shift;

  it("dice con quién está el turno en cada paso", () => {
    const named = (status: ShiftStatus) =>
      nextStepFor(shift({ status, worker_name: "Ana Pérez" })).hint;
    expect(named("asignado")).toBe("Asignado a Ana. Esperando que confirme su asistencia.");
    expect(named("confirmado")).toBe("Ana confirmó. Te avisamos cuando salga para allá.");
    expect(named("en_camino")).toBe("Ana va en camino al local.");
    expect(named("check_in")).toBe("Ana llegó al local.");
    expect(named("trabajando")).toBe("Ana está trabajando ahora.");
    expect(named("check_out")).toBe("Ana terminó de trabajar.");
  });

  it("sin nombre (vacío o ausente) cae a la línea de siempre", () => {
    for (const worker_name of [undefined, null, "", "   "]) {
      expect(nextStepFor(shift({ status: "asignado", worker_name })).hint).toBe(
        "Esperando que confirme su asistencia."
      );
      expect(nextStepFor(shift({ status: "confirmado", worker_name })).hint).toBe(
        "Confirmó. Te avisamos cuando salga para allá."
      );
    }
  });

  it("no inventa nombre en estados sin trabajador", () => {
    expect(nextStepFor(shift({ status: "pagado", worker_name: "Ana" })).hint).toBe(
      "Listo: trabajado y pagado."
    );
    expect(nextStepFor(shift({ status: "publicado", worker_name: "Ana" })).hint).toBe("");
  });

  it("el botón de elegir lleva la cantidad de postulaciones", () => {
    for (const status of ["publicado", "buscando_personal"] as const) {
      expect(nextStepFor(shift({ status, pending_applicants_count: 2 })).actionLabel).toBe(
        "Elegir a alguien (2)"
      );
      expect(nextStepFor(shift({ status, pending_applicants_count: 1 })).actionLabel).toBe(
        "Elegir a alguien (1)"
      );
    }
  });

  it("con cero postulaciones o sin dato, el botón queda como estaba", () => {
    for (const pending_applicants_count of [0, null, undefined]) {
      expect(
        nextStepFor(shift({ status: "publicado", pending_applicants_count })).actionLabel
      ).toBe("Elegir a alguien");
    }
  });
});

