import { describe, expect, it } from "vitest";
import { suspensionImpactLines } from "./people";

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
