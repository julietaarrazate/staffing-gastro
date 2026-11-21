import { describe, expect, it } from "vitest";
import { diasDelChip, filtrarTurnos, hayFiltros, SIN_FILTROS } from "./filtros-mapa";

// Argentina es UTC-3 todo el año. Instantes en UTC; el día que importa es el de Buenos Aires.
const t = (iso: string) => new Date(iso);
// Lunes 2026-11-16 … domingo 2026-11-22.
const LUNES_MEDIODIA = t("2026-11-16T15:00:00Z"); // 12:00 ART
const VIERNES_NOCHE = t("2026-11-21T01:30:00Z"); // viernes 20/11 22:30 ART
const VIERNES_23_ART = t("2026-11-21T02:30:00Z"); // viernes 20/11 23:30 ART (ya sábado en UTC)
const SABADO = t("2026-11-21T15:00:00Z"); // sábado 21/11 12:00 ART
const DOMINGO = t("2026-11-22T15:00:00Z"); // domingo 22/11 12:00 ART

describe("diasDelChip", () => {
  it("hoy y mañana en hora de Argentina, no en UTC", () => {
    // 02:30 UTC del sábado 21 = 23:30 ART del viernes 20.
    expect(diasDelChip("hoy", t("2026-11-21T02:30:00Z"))).toEqual(["2026-11-20"]);
    expect(diasDelChip("manana", t("2026-11-21T02:30:00Z"))).toEqual(["2026-11-21"]);
    // 03:00 UTC = 00:00 ART: ya es el día siguiente.
    expect(diasDelChip("hoy", t("2026-11-21T03:00:00Z"))).toEqual(["2026-11-21"]);
    expect(diasDelChip("hoy", t("2026-11-21T02:59:59Z"))).toEqual(["2026-11-20"]);
  });

  it("mañana cruza el fin de mes y de año", () => {
    expect(diasDelChip("manana", t("2026-12-31T15:00:00Z"))).toEqual(["2027-01-01"]);
    expect(diasDelChip("manana", t("2026-11-30T15:00:00Z"))).toEqual(["2026-12-01"]);
  });

  it("fin de semana: de lunes a viernes, el sábado y domingo que vienen", () => {
    expect(diasDelChip("finde", LUNES_MEDIODIA)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(diasDelChip("finde", t("2026-11-20T15:00:00Z"))).toEqual(["2026-11-21", "2026-11-22"]); // viernes
  });

  it("fin de semana el viernes a la noche (ART) sigue siendo el que viene", () => {
    // Ya es sábado en UTC pero viernes 23:30 en Argentina.
    expect(diasDelChip("finde", VIERNES_23_ART)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(diasDelChip("finde", VIERNES_NOCHE)).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("fin de semana ya empezado: el sábado y el domingo de hoy", () => {
    expect(diasDelChip("finde", SABADO)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(diasDelChip("finde", DOMINGO)).toEqual(["2026-11-21", "2026-11-22"]);
    // Domingo a las 23:30 ART (ya lunes en UTC) sigue siendo domingo.
    expect(diasDelChip("finde", t("2026-11-23T02:30:00Z"))).toEqual(["2026-11-21", "2026-11-22"]);
    // Lunes 00:00 ART: el que viene.
    expect(diasDelChip("finde", t("2026-11-23T03:00:00Z"))).toEqual(["2026-11-28", "2026-11-29"]);
  });
});

const turno = (id: string, start_at: string, pay_band: "por_encima" | null = null) =>
  ({ id, start_at, pay_band }) as { id: string; start_at: string; pay_band: "por_encima" | null };

describe("filtrarTurnos", () => {
  const ahora = t("2026-11-20T15:00:00Z"); // viernes 12:00 ART
  const turnos = [
    turno("hoy-tarde", "2026-11-20T23:00:00-03:00"),
    turno("hoy-madrugada", "2026-11-20T00:30:00-03:00", "por_encima"),
    turno("manana", "2026-11-21T09:00:00-03:00"),
    turno("domingo", "2026-11-22T21:00:00-03:00", "por_encima"),
    turno("lunes", "2026-11-23T10:00:00-03:00"),
    // 23:30 ART del viernes = 02:30 UTC del sábado: es del viernes.
    turno("viernes-23", "2026-11-21T02:30:00Z"),
  ];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it("sin filtros devuelve todo", () => {
    expect(hayFiltros(SIN_FILTROS)).toBe(false);
    expect(filtrarTurnos(turnos, SIN_FILTROS, ahora)).toBe(turnos);
  });

  it("Hoy mira el día de inicio en Argentina (no el de UTC)", () => {
    expect(ids(filtrarTurnos(turnos, { cuando: "hoy", pagaMas: false }, ahora))).toEqual([
      "hoy-tarde",
      "hoy-madrugada",
      "viernes-23",
    ]);
  });

  it("Mañana y Fin de semana", () => {
    expect(ids(filtrarTurnos(turnos, { cuando: "manana", pagaMas: false }, ahora))).toEqual(["manana"]);
    expect(ids(filtrarTurnos(turnos, { cuando: "finde", pagaMas: false }, ahora))).toEqual(["manana", "domingo"]);
  });

  it("Paga más se combina con el día y también anda solo", () => {
    expect(ids(filtrarTurnos(turnos, { cuando: null, pagaMas: true }, ahora))).toEqual(["hoy-madrugada", "domingo"]);
    expect(ids(filtrarTurnos(turnos, { cuando: "hoy", pagaMas: true }, ahora))).toEqual(["hoy-madrugada"]);
    expect(filtrarTurnos(turnos, { cuando: "manana", pagaMas: true }, ahora)).toEqual([]);
  });

  it("el domingo, Fin de semana incluye el sábado de ayer y el domingo de hoy", () => {
    const domingo = t("2026-11-22T15:00:00Z");
    const ts = [turno("sab", "2026-11-21T20:00:00-03:00"), turno("dom", "2026-11-22T20:00:00-03:00"), turno("lun", "2026-11-23T08:00:00-03:00")];
    expect(ids(filtrarTurnos(ts, { cuando: "finde", pagaMas: false }, domingo))).toEqual(["sab", "dom"]);
  });
});
