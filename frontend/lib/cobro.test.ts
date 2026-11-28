import { describe, expect, it } from "vitest";
import { cobroParaElComercio, cuandoPuedeAvisar, estadoCobro } from "./cobro";

const base = {
  paid_at: null,
  worker_confirmed_paid_at: null,
  worker_reported_unpaid_at: null,
  unpaid_report_opens_at: "2026-11-28T03:58:00Z",
};

describe("estadoCobro", () => {
  it("sin respuesta, pregunta; antes del plazo no deja avisar y dice desde cuándo", () => {
    const e = estadoCobro(base, new Date("2026-11-27T20:00:00Z"));
    expect(e).toMatchObject({ fase: "pregunta", puedeAvisar: false, avisarDesde: base.unpaid_report_opens_at });
  });
  it("pasado el plazo deja avisar", () => {
    const e = estadoCobro(base, new Date("2026-11-28T03:58:00Z"));
    expect(e).toMatchObject({ fase: "pregunta", puedeAvisar: true, avisarDesde: null });
  });
  it("si el comercio marcó pagado, el servidor abre el aviso desde ese momento", () => {
    const e = estadoCobro(
      { ...base, paid_at: "2026-11-27T19:00:00Z", unpaid_report_opens_at: "2026-11-27T19:00:00Z" },
      new Date("2026-11-27T20:00:00Z"),
    );
    expect(e).toMatchObject({ puedeAvisar: true, comercioMarcoPagado: true });
  });
  it("confirmado gana sobre avisado; avisado se distingue de la pregunta", () => {
    const ahora = new Date("2026-11-29T00:00:00Z");
    expect(estadoCobro({ ...base, worker_reported_unpaid_at: "2026-11-28T05:00:00Z" }, ahora).fase).toBe("avisado");
    expect(
      estadoCobro(
        { ...base, worker_reported_unpaid_at: "2026-11-28T05:00:00Z", worker_confirmed_paid_at: "2026-11-28T06:00:00Z" },
        ahora,
      ).fase,
    ).toBe("confirmado");
  });
  it("sin fecha del servidor (turno sin terminar) no deja avisar", () => {
    expect(estadoCobro({ ...base, unpaid_report_opens_at: null }, new Date()).puedeAvisar).toBe(false);
  });
});

describe("cuandoPuedeAvisar", () => {
  it("en hora argentina", () => {
    expect(cuandoPuedeAvisar("2026-11-28T03:58:00Z")).toBe("el 28/11 a las 00:58");
  });
});

describe("cobroParaElComercio", () => {
  const sin = { worker_name: "Lucía Pérez", worker_confirmed_paid_at: null, worker_reported_unpaid_at: null };
  it("nada si no dijo nada", () => expect(cobroParaElComercio(sin)).toBeNull());
  it("confirmó", () =>
    expect(cobroParaElComercio({ ...sin, worker_confirmed_paid_at: "x" })).toEqual({
      tono: "ok",
      texto: "Lucía Pérez confirmó que cobró",
    }));
  it("avisó que no cobró", () =>
    expect(cobroParaElComercio({ ...sin, worker_reported_unpaid_at: "x" })).toEqual({
      tono: "aviso",
      texto: "Lucía Pérez avisó que todavía no cobró",
    }));
  it("sin nombre, «La persona»", () =>
    expect(cobroParaElComercio({ ...sin, worker_name: null, worker_reported_unpaid_at: "x" })?.texto).toBe(
      "La persona avisó que todavía no cobró",
    ));
});
