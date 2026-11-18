import { describe, expect, it } from "vitest";
import {
  BETA_SIN_TOPE_TEXT,
  formatPlainDate,
  isInactivePlanMessage,
  limiteExigido,
  paymentReturnMessage,
  usoSinTopeText,
} from "@/lib/subscription";

describe("paymentReturnMessage", () => {
  it("tiene un mensaje claro para cada vuelta de Mercado Pago", () => {
    expect(paymentReturnMessage("ok")?.tone).toBe("ok");
    expect(paymentReturnMessage("pendiente")?.title).toMatch(/pendiente/);
    expect(paymentReturnMessage("error")?.text).toMatch(/No se te cobró nada/);
  });

  it("sin parámetro o con uno desconocido no muestra nada", () => {
    expect(paymentReturnMessage(null)).toBeNull();
    expect(paymentReturnMessage("cualquiera")).toBeNull();
  });
});

describe("isInactivePlanMessage", () => {
  it("distingue el plan sin pagar del tope de turnos", () => {
    expect(
      isInactivePlanMessage("Tu plan no está activo. Pagá el mes desde Mi plan para volver a publicar turnos.")
    ).toBe(true);
    expect(isInactivePlanMessage("Alcanzaste el límite de turnos de tu plan (5/mes).")).toBe(false);
    expect(isInactivePlanMessage(null)).toBe(false);
  });
});

describe("formatPlainDate", () => {
  it("formatea la fecha sin correrla por zona horaria", () => {
    expect(formatPlainDate("2026-11-01")).toBe("1/11/2026");
  });
});

describe("tope de turnos (G11)", () => {
  it("se exige salvo que el servidor diga false", () => {
    expect(limiteExigido({ limite_exigido: false })).toBe(false);
    expect(limiteExigido({ limite_exigido: true })).toBe(true);
    expect(limiteExigido({})).toBe(true);
  });

  it("el uso sin tope no parece excedido", () => {
    expect(usoSinTopeText(9)).toBe("9 turnos publicados este mes");
    expect(usoSinTopeText(1)).toBe("1 turno publicado este mes");
    expect(usoSinTopeText(0)).toBe("0 turnos publicados este mes");
    expect(BETA_SIN_TOPE_TEXT).toBe("Durante la beta no hay tope de turnos.");
  });
});
