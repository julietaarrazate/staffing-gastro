import { describe, expect, it } from "vitest";
import {
  adminCloseHint,
  adminCloseLines,
  adminCloseResult,
  suspensionImpactLines,
} from "./people";

describe("suspensionImpactLines", () => {
  it("sin turnos tocados lo dice en una frase", () => {
    expect(suspensionImpactLines({ hidden: 0, cancelled: 0, reopened: 0 })).toEqual([
      "No tiene turnos por cubrir: no se toca ninguno.",
    ]);
  });

  it("comercio: oculta y cancela, en singular y en plural", () => {
    expect(suspensionImpactLines({ hidden: 1, cancelled: 1, reopened: 0 })).toEqual([
      "Se oculta 1 turno abierto: nadie lo ve ni se postula. Si la reactivás, vuelve a verse.",
      "Se cancela 1 turno con alguien asignado o confirmado. Le avisamos a esa persona, sin penalidad para nadie.",
    ]);
    expect(suspensionImpactLines({ hidden: 3, cancelled: 2, reopened: 0 })).toEqual([
      "Se ocultan 3 turnos abiertos: nadie los ve ni se postula. Si la reactivás, vuelven a verse.",
      "Se cancelan 2 turnos con alguien asignado o confirmado. Le avisamos a cada persona, sin penalidad para nadie.",
    ]);
  });

  it("trabajador: reabre", () => {
    expect(suspensionImpactLines({ hidden: 0, cancelled: 0, reopened: 1 })).toEqual([
      "1 turno suyo vuelve a buscar personal. Le avisamos al comercio, sin sumarle una cancelación.",
    ]);
    expect(suspensionImpactLines({ hidden: 0, cancelled: 0, reopened: 4 })).toEqual([
      "4 turnos suyos vuelven a buscar personal. Le avisamos a cada comercio, sin sumarle una cancelación.",
    ]);
  });
});

describe("«Cerrar turno» (decisión 21)", () => {
  const SALIDA = { check_out: true, finish: false, notifies: "company" as const };
  const CIERRE = { check_out: false, finish: true, notifies: "worker" as const };
  const LAS_DOS = { check_out: true, finish: true, notifies: null };
  const CIERRE_SIN_AVISO = { check_out: false, finish: true, notifies: null };

  it("la fila dice por qué aparece el botón", () => {
    expect(adminCloseHint(SALIDA)).toBe("No puede entrar a marcar la salida.");
    expect(adminCloseHint(CIERRE)).toBe("El comercio no puede entrar a cerrarlo.");
    expect(adminCloseHint(LAS_DOS)).toBe("Nadie puede entrar a marcar la salida ni a cerrarlo.");
  });

  it("trabajador suspendido: marca la salida a la hora de ahora y avisa al comercio", () => {
    expect(adminCloseLines(SALIDA, "21:40")).toEqual([
      "Marcamos la salida de la persona a las 21:40, en su nombre.",
      "Le avisamos al comercio para que cierre el turno, como siempre.",
      "No se marca como pagado. Queda registrado que lo hiciste vos.",
    ]);
  });

  it("comercio suspendido: cierra, suma el turno y avisa a la persona", () => {
    expect(adminCloseLines(CIERRE, "21:40")).toEqual([
      "Cerramos el turno en nombre del comercio.",
      "Le suma el turno a la persona, con la puntualidad de su llegada.",
      "Le avisamos a la persona para que califique al comercio.",
      "No se marca como pagado. Queda registrado que lo hiciste vos.",
    ]);
  });

  it("las dos suspendidas: las dos cosas y sin avisos", () => {
    expect(adminCloseLines(LAS_DOS, "21:40")).toEqual([
      "Marcamos la salida de la persona a las 21:40 y cerramos el turno, en nombre de las dos cuentas.",
      "Le suma el turno a la persona, con la puntualidad de su llegada.",
      "Nadie recibe avisos en el celular: las dos cuentas están suspendidas.",
      "No se marca como pagado. Queda registrado que lo hiciste vos.",
    ]);
    expect(adminCloseLines(CIERRE_SIN_AVISO, "21:40")[2]).toBe(
      "Nadie recibe avisos en el celular: las dos cuentas están suspendidas."
    );
  });

  it("el resultado dice qué se hizo y a quién se avisó", () => {
    const base = { shift_id: "s", status: "check_out", checked_out_at: "2026-11-18T00:40:00Z" };
    expect(adminCloseResult({ ...base, ...SALIDA }, "21:40")).toBe(
      "Marcamos la salida a las 21:40. Le avisamos al comercio para que lo cierre."
    );
    expect(adminCloseResult({ ...base, ...CIERRE, status: "finalizado" }, null)).toBe(
      "Cerramos el turno. Le avisamos a la persona para que califique."
    );
    expect(adminCloseResult({ ...base, ...LAS_DOS, status: "finalizado" }, "21:40")).toBe(
      "Marcamos la salida a las 21:40 y cerramos el turno."
    );
  });
});
