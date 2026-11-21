import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { semanaArgentina } from "./semana";
import { diaParaFamilia, familyOf, ordenMasAdelante, resumenPanel, tituloDelDia, turnosEnLaVista } from "./panel-comercio";

// Mediodía en Buenos Aires.
const AHORA = new Date("2026-11-20T15:00:00Z");
const HOY = "2026-11-20T21:00:00-03:00";
const MANANA = "2026-11-21T21:00:00-03:00";
const AYER = "2026-11-19T23:00:00-03:00";

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

const dia = (n: number) => `2026-11-${String(n).padStart(2, "0")}T21:00:00-03:00`;

describe("resumenPanel", () => {
  it("sin turnos en curso el cielo no está en marcha, aunque haya historia", () => {
    const r = resumenPanel([turno("a", "pagado"), turno("b", "cancelado"), turno("c", "borrador")]);
    expect(r.enMarcha).toBe(false);
    expect(r.elegir).toBeNull();
    expect(r.nadie).toBeNull();
  });

  it("elegir: el turno con postulaciones pendientes que empieza antes", () => {
    const r = resumenPanel([
      turno("tarde", "publicado", { start_at: MANANA, pending_applicants_count: 5 }),
      turno("sin", "publicado", { pending_applicants_count: 0 }),
      turno("antes", "buscando_personal", { pending_applicants_count: 2 }),
      turno("asignado", "asignado", { pending_applicants_count: 3 }),
    ]);
    expect(r.elegir?.id).toBe("antes");
    expect(r.nadie).toBeNull();
  });

  it("nadie: hay turnos buscando y ninguno tiene postulaciones (o no llegó el dato)", () => {
    const r = resumenPanel([
      turno("b", "publicado", { start_at: MANANA, pending_applicants_count: null }),
      turno("a", "publicado", { pending_applicants_count: 0 }),
    ]);
    expect(r.elegir).toBeNull();
    expect(r.nadie?.id).toBe("a");
    expect(r.marchando).toBe(true);
  });

  it("con todo cubierto no late «Marchando» ni hay a quién elegir", () => {
    expect(resumenPanel([turno("a", "confirmado")])).toMatchObject({ enMarcha: true, marchando: false, elegir: null, nadie: null });
  });
});

// AHORA es viernes 20 de noviembre de 2026, mediodía en Buenos Aires.
describe("tituloDelDia", () => {
  it("hoy, sin tocar la tira: cuenta los de hoy; cancelados y borradores no cuentan", () => {
    const t = tituloDelDia(
      [turno("a", "publicado"), turno("b", "confirmado"), turno("c", "finalizado"), turno("d", "cancelado"), turno("e", "borrador"), turno("f", "pagado", { start_at: AYER, end_at: AYER })],
      null,
      AHORA
    );
    expect(t).toMatchObject({ antes: "Hoy tenés", destacado: "3 turnos", cuenta: 3, sinCubrir: 1, proximo: null, conSaludo: true });
  });

  it("singular y plural", () => {
    expect(tituloDelDia([turno("a", "confirmado")], null, AHORA).destacado).toBe("1 turno");
    expect(tituloDelDia([turno("a", "confirmado"), turno("b", "confirmado")], null, AHORA).destacado).toBe("2 turnos");
  });

  it("«sin cubrir» cuenta los que buscan personal; con todo cubierto es 0", () => {
    const t = tituloDelDia([turno("a", "publicado"), turno("b", "buscando_personal"), turno("c", "confirmado")], null, AHORA);
    expect(t.sinCubrir).toBe(2);
    expect(tituloDelDia([turno("c", "confirmado")], null, AHORA).sinCubrir).toBe(0);
  });

  it("con otro día elegido cuenta ese día y no saluda: «El sábado tenés 2 turnos»", () => {
    const t = tituloDelDia(
      [turno("hoy", "publicado"), turno("a", "publicado", { start_at: dia(21) }), turno("b", "confirmado", { start_at: dia(21) })],
      "2026-11-21",
      AHORA
    );
    expect(t).toMatchObject({ antes: "Mañana tenés", destacado: "2 turnos", sinCubrir: 1, conSaludo: false });
    const sabado = tituloDelDia([turno("a", "publicado", { start_at: dia(21) })], "2026-11-21", new Date("2026-11-19T15:00:00Z"));
    expect(sabado).toMatchObject({ antes: "El sábado tenés", destacado: "1 turno" });
  });

  it("un día de más de una semana lleva el número: «El lunes 30 tenés…»", () => {
    expect(tituloDelDia([turno("a", "publicado", { start_at: dia(30) })], "2026-11-30", AHORA).antes).toBe("El lunes 30 tenés");
  });

  it("un día sin turnos lo dice, y un día pasado va en pasado", () => {
    expect(tituloDelDia([turno("a", "publicado")], "2026-11-24", AHORA).antes).toBe("El martes no tenés turnos");
    expect(tituloDelDia([turno("a", "pagado", { start_at: AYER })], "2026-11-19", AHORA)).toMatchObject({ antes: "El jueves tuviste", destacado: "1 turno" });
    expect(tituloDelDia([], "2026-11-17", AHORA).antes).toBe("El martes no tuviste turnos");
  });

  it("elegir hoy a mano es lo mismo que no elegir", () => {
    expect(tituloDelDia([turno("a", "confirmado")], "2026-11-20", AHORA)).toMatchObject({ antes: "Hoy tenés", conSaludo: true });
  });

  it("hoy sin turnos: lo dice y avisa el próximo (que está en curso)", () => {
    const sin = tituloDelDia(
      [turno("p", "publicado", { start_at: dia(27) }), turno("q", "publicado", { start_at: dia(25) }), turno("x", "cancelado", { start_at: dia(23) })],
      null,
      AHORA
    );
    expect(sin).toMatchObject({ antes: "Hoy no tenés turnos", destacado: "", cuenta: 0, proximo: "El próximo es el miércoles" });
  });

  it("el próximo: mañana, lejos con número, y nada si no hay otro", () => {
    expect(tituloDelDia([turno("p", "publicado", { start_at: MANANA })], null, AHORA).proximo).toBe("El próximo es mañana");
    expect(tituloDelDia([turno("p", "publicado", { start_at: "2026-12-04T21:00:00-03:00" })], null, AHORA).proximo).toBe("El próximo es el viernes 4");
    expect(tituloDelDia([turno("p", "pagado", { start_at: AYER })], null, AHORA).proximo).toBeNull();
    expect(tituloDelDia([], null, AHORA)).toMatchObject({ antes: "Hoy no tenés turnos", proximo: null });
  });

  it("el próximo no se ofrece mirando otro día", () => {
    expect(tituloDelDia([turno("p", "publicado", { start_at: dia(27) })], "2026-11-24", AHORA).proximo).toBeNull();
  });

  it("un turno de anoche que sigue en marcha cuenta como de hoy", () => {
    const anoche = turno("anoche", "trabajando", { start_at: AYER, end_at: "2026-11-20T02:00:00-03:00" });
    expect(tituloDelDia([anoche], null, new Date("2026-11-20T04:00:00Z"))).toMatchObject({ cuenta: 1, destacado: "1 turno" });
    expect(tituloDelDia([anoche], null, AHORA).cuenta).toBe(0);
  });

  it("el día es el de Argentina: un turno a las 23:30 de allá no es de «mañana» por el UTC", () => {
    const tarde = turno("t", "confirmado", { start_at: "2026-11-20T23:30:00-03:00" });
    expect(tituloDelDia([tarde], null, AHORA)).toMatchObject({ cuenta: 1 });
  });
});

describe("la vista y «Más adelante»", () => {
  const semana = semanaArgentina(AHORA);
  it("sin día: la semana (de lunes a domingo); con día: sólo ese día", () => {
    const lista = [turno("l", "publicado", { start_at: dia(16) }), turno("v", "publicado"), turno("d", "publicado", { start_at: dia(22) }), turno("sig", "publicado", { start_at: dia(23) })];
    expect(turnosEnLaVista(lista, semana, null).map((s) => s.id)).toEqual(["l", "v", "d"]);
    expect(turnosEnLaVista(lista, semana, "2026-11-22").map((s) => s.id)).toEqual(["d"]);
  });

  it("«Más adelante»: los que buscan personal primero, cada grupo por fecha; lo de esta semana y antes no entra", () => {
    const lista = [
      turno("conf-26", "confirmado", { start_at: dia(26) }),
      turno("busca-30", "publicado", { start_at: dia(30) }),
      turno("hoy", "publicado"),
      turno("conf-24", "confirmado", { start_at: dia(24) }),
      turno("busca-25", "buscando_personal", { start_at: dia(25) }),
      turno("ayer", "pagado", { start_at: AYER }),
    ];
    expect(ordenMasAdelante(lista, "2026-11-22").map((s) => s.id)).toEqual(["busca-25", "busca-30", "conf-24", "conf-26"]);
    expect(ordenMasAdelante([], "2026-11-22")).toEqual([]);
  });
});

describe("diaParaFamilia (los enlaces con ?tab=)", () => {
  const semana = semanaArgentina(AHORA);
  it("si el grupo ya está en la semana que se ve, no hace falta saltar", () => {
    expect(diaParaFamilia([turno("a", "publicado")], "buscando", semana, AHORA)).toBeNull();
  });
  it("si no, salta al primero que viene", () => {
    const lista = [turno("pasado", "publicado", { start_at: dia(2) }), turno("b", "publicado", { start_at: dia(30) }), turno("a", "buscando_personal", { start_at: dia(25) })];
    expect(diaParaFamilia(lista, "buscando", semana, AHORA)).toBe("2026-11-25");
  });
  it("y si todos son pasados, al último", () => {
    const lista = [turno("a", "pagado", { start_at: dia(2) }), turno("b", "pagado", { start_at: dia(9) })];
    expect(diaParaFamilia(lista, "terminado", semana, AHORA)).toBe("2026-11-09");
  });
  it("sin ninguno de ese grupo, null", () => {
    expect(diaParaFamilia([turno("a", "publicado")], "cancelado", semana, AHORA)).toBeNull();
  });
});
