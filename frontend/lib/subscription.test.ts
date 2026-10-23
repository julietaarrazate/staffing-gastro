import { describe, expect, it } from "vitest";
import { formatPlainDate, isInactivePlanMessage, paymentReturnMessage } from "@/lib/subscription";

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
