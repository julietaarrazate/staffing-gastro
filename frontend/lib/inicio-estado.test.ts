import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decidirInicio, type InicioEntrada } from "@/lib/inicio-estado";
import type { Shift, ShiftStatus } from "@/lib/types";

/** Hora de Argentina (UTC-3) a ISO. */
const ar = (dia: string, hora: string) => `${dia}T${hora}:00-03:00`;
const AHORA = new Date(ar("2026-11-19", "18:00"));

function turno(inicio: string, fin: string, extra: Partial<Shift> = {}): Shift {
  return {
    id: "s1",
    position: "bartender",
    start_at: inicio,
    end_at: fin,
    status: "confirmado" as ShiftStatus,
    company_name: "Bar Mirasol",
    address: "Thames 1840",
    city: "Palermo",
    ...extra,
  } as Shift;
}
const aceptada = (shift: Shift | null | undefined) => ({ status: "aceptada" as const, shift });

function decidir(p: InicioEntrada["postulaciones"], extra: Partial<InicioEntrada> = {}) {
  return decidirInicio({ postulaciones: p, turnosParaMostrar: 3, ahora: AHORA, cargando: false, ...extra });
}

describe("decidirInicio", () => {
  it("D: cargando manda sobre todo", () => {
    const p = [aceptada(turno(ar("2026-11-19", "20:00"), ar("2026-11-20", "02:00")))];
    expect(decidir(p, { cargando: true })).toEqual({ tipo: "cargando" });
  });

  it("A1: faltan más de 60 min -> hora de inicio y datos del turno", () => {
    const e = decidir([aceptada(turno(ar("2026-11-19", "20:00"), ar("2026-11-20", "02:00")))]);
    expect(e).toEqual({
      tipo: "hoy-mas-tarde",
      turno: {
        shiftId: "s1",
        puesto: "Bartender",
        local: "Bar Mirasol",
        lugar: "Thames 1840 · Palermo",
        horaInicio: "20:00",
        horaFin: "02:00",
      },
    });
  });

  it("el borde: a 61 min es A1, a 60 min es A2", () => {
    const a61 = decidir([aceptada(turno(ar("2026-11-19", "19:01"), ar("2026-11-19", "23:00")))]);
    expect(a61.tipo).toBe("hoy-mas-tarde");
    const a60 = decidir([aceptada(turno(ar("2026-11-19", "19:00"), ar("2026-11-19", "23:00")))]);
    expect(a60).toMatchObject({ tipo: "hoy-por-empezar", minutos: 60 });
  });

  it("A2: cuenta los minutos hacia arriba y llega a 1 antes de empezar", () => {
    const e = decidir([aceptada(turno(ar("2026-11-19", "18:28"), ar("2026-11-19", "23:00")))]);
    expect(e).toMatchObject({ tipo: "hoy-por-empezar", minutos: 28 });
    // faltan 30 s: sigue diciendo «1 min» (no «0 min»)
    const uno = decidir([aceptada(turno(ar("2026-11-19", "18:28"), ar("2026-11-19", "23:00")))], {
      ahora: new Date(new Date(ar("2026-11-19", "18:27")).getTime() + 30_000),
    });
    expect(uno).toMatchObject({ tipo: "hoy-por-empezar", minutos: 1 });
  });

  it("A3: a la hora exacta de inicio ya empezó", () => {
    const e = decidir([aceptada(turno(ar("2026-11-19", "18:00"), ar("2026-11-19", "23:00")))]);
    expect(e).toMatchObject({ tipo: "hoy-en-curso", turno: { horaFin: "23:00" } });
  });

  it("un turno que terminó ya no cuenta (a la hora exacta de fin)", () => {
    const e = decidir([aceptada(turno(ar("2026-11-19", "12:00"), ar("2026-11-19", "18:00")))]);
    expect(e.tipo).toBe("con-turnos");
  });

  it("el turno de mañana no cuenta", () => {
    const e = decidir([aceptada(turno(ar("2026-11-20", "09:00"), ar("2026-11-20", "15:00")))]);
    expect(e.tipo).toBe("con-turnos");
  });

  it("el turno de ayer que termina hoy de madrugada cuenta mientras está en curso", () => {
    const ahora = new Date(ar("2026-11-19", "01:00"));
    const p = [aceptada(turno(ar("2026-11-18", "22:00"), ar("2026-11-19", "02:00")))];
    expect(decidir(p, { ahora })).toMatchObject({ tipo: "hoy-en-curso", turno: { horaFin: "02:00" } });
    // y a las 02:00 ya no
    expect(decidir(p, { ahora: new Date(ar("2026-11-19", "02:00")) }).tipo).toBe("con-turnos");
  });

  it("con dos turnos hoy, el en curso gana al próximo; sin ninguno en curso, el que empieza primero", () => {
    const enCurso = turno(ar("2026-11-19", "15:00"), ar("2026-11-19", "19:00"), { id: "en-curso" });
    const proximo = turno(ar("2026-11-19", "19:30"), ar("2026-11-19", "23:00"), { id: "proximo" });
    const tarde = turno(ar("2026-11-19", "22:00"), ar("2026-11-20", "03:00"), { id: "tarde" });
    expect(decidir([aceptada(proximo), aceptada(enCurso)])).toMatchObject({ turno: { shiftId: "en-curso" } });
    expect(decidir([aceptada(tarde), aceptada(proximo)])).toMatchObject({
      tipo: "hoy-mas-tarde",
      turno: { shiftId: "proximo" },
    });
  });

  it("E: una postulación aceptada sin shift se ignora (null o ausente)", () => {
    expect(decidir([aceptada(null), aceptada(undefined)]).tipo).toBe("con-turnos");
    expect(decidir([aceptada(null)], { turnosParaMostrar: 0 }).tipo).toBe("tranquilo");
  });

  it("sólo cuentan las aceptadas", () => {
    const t = turno(ar("2026-11-19", "20:00"), ar("2026-11-20", "02:00"));
    for (const status of ["pendiente", "rechazada", "retirada", "desasignada"] as const) {
      expect(decidir([{ status, shift: t }]).tipo).toBe("con-turnos");
    }
  });

  it("un turno cancelado, no cubierto o terminado no cuenta", () => {
    for (const status of ["cancelado", "no_cubierto", "finalizado", "pagado", "check_out"] as ShiftStatus[]) {
      const t = turno(ar("2026-11-19", "17:00"), ar("2026-11-19", "23:00"), { status });
      expect(decidir([aceptada(t)]).tipo).toBe("con-turnos");
    }
  });

  it("sin local: el local es null; sin dirección ni zona, el lugar es null", () => {
    const t = turno(ar("2026-11-19", "20:00"), ar("2026-11-20", "02:00"), {
      company_name: null,
      address: null,
      city: null,
    });
    expect(decidir([aceptada(t)])).toMatchObject({ turno: { local: null, lugar: null } });
  });

  it("B / C / error: sin turno de hoy", () => {
    expect(decidir([], { turnosParaMostrar: 2 }).tipo).toBe("con-turnos");
    expect(decidir([], { turnosParaMostrar: 0 }).tipo).toBe("tranquilo");
    expect(decidir([], { turnosParaMostrar: 0, conError: true }).tipo).toBe("con-error");
  });
});

describe("el día es el de Argentina aunque el navegador esté en otra zona", () => {
  const zonaOriginal = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Asia/Tokyo";
  });
  afterAll(() => {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  it("a las 21:30 del 19 en Argentina (09:30 del 20 en Tokio), un turno de las 23:00 es de hoy", () => {
    const ahora = new Date("2026-11-20T00:30:00Z"); // 21:30 del 19 en Argentina
    const t = turno("2026-11-20T02:00:00Z", "2026-11-20T06:00:00Z"); // 23:00 a 03:00 AR
    expect(decidir([aceptada(t)], { ahora })).toMatchObject({
      tipo: "hoy-mas-tarde",
      turno: { horaInicio: "23:00", horaFin: "03:00" },
    });
  });

  it("a las 00:30 del 20 en Argentina, un turno de las 22:00 del 19 ya terminó y uno de las 09:00 del 20 es de hoy", () => {
    const ahora = new Date("2026-11-20T03:30:00Z"); // 00:30 del 20 AR (12:30 del 20 en Tokio)
    const ayer = turno("2026-11-20T01:00:00Z", "2026-11-20T03:00:00Z"); // 22:00 a 00:00 del 19-20 AR
    const hoy = turno("2026-11-20T12:00:00Z", "2026-11-20T18:00:00Z"); // 09:00 a 15:00 AR
    expect(decidir([aceptada(ayer)], { ahora }).tipo).toBe("con-turnos");
    expect(decidir([aceptada(hoy)], { ahora })).toMatchObject({ tipo: "hoy-mas-tarde", turno: { horaInicio: "09:00" } });
  });

  it("con el navegador ya en el día siguiente, manda el día de Argentina", () => {
    const ahora = new Date("2026-11-19T20:00:00Z"); // 17:00 del 19 AR; 05:00 del 20 en Tokio
    const t = turno("2026-11-19T22:30:00Z", "2026-11-20T04:00:00Z"); // 19:30 AR del 19
    expect(decidir([aceptada(t)], { ahora })).toMatchObject({ turno: { horaInicio: "19:30" } });
    // y el turno del 20 en Argentina (no hoy) no cuenta aunque en Tokio ya sea 20 desde hace horas
    const manana = turno("2026-11-20T12:00:00Z", "2026-11-20T18:00:00Z");
    expect(decidir([aceptada(manana)], { ahora }).tipo).toBe("con-turnos");
  });
});
