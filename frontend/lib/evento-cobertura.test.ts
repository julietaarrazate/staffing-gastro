import { describe, expect, it } from "vitest";
import { coberturaPorEvento } from "./evento-cobertura";
import type { ShiftStatus } from "./types";

const puesto = (status: ShiftStatus, event_id = "e1") => ({
  event_id,
  event_name: "Boda",
  status,
});

describe("coberturaPorEvento", () => {
  it("cuenta como cubiertos a los confirmados en adelante", () => {
    const [evento] = coberturaPorEvento([
      puesto("confirmado"),
      puesto("check_in"),
      puesto("pagado"),
      puesto("asignado"),
      puesto("buscando_personal"),
    ]);
    expect(evento).toMatchObject({ total: 5, covered: 3 });
  });

  it("no cuenta los cancelados: el contador baja al cancelar", () => {
    const antes = coberturaPorEvento([puesto("confirmado"), puesto("buscando_personal")]);
    const despues = coberturaPorEvento([puesto("confirmado"), puesto("cancelado")]);
    expect(antes[0]).toMatchObject({ total: 2, covered: 1 });
    expect(despues[0]).toMatchObject({ total: 1, covered: 1 });
  });

  it("un evento con todos los puestos cancelados no aparece", () => {
    expect(coberturaPorEvento([puesto("cancelado"), puesto("cancelado")])).toEqual([]);
  });

  it("ignora turnos sueltos y separa eventos", () => {
    const grupos = coberturaPorEvento([
      { status: "confirmado" as const },
      puesto("confirmado", "e1"),
      puesto("publicado", "e2"),
    ]);
    expect(grupos.map((g) => [g.eventId, g.total, g.covered])).toEqual([
      ["e1", 1, 1],
      ["e2", 1, 0],
    ]);
  });
});
