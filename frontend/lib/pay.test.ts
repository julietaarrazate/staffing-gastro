import { describe, expect, it } from "vitest";
import { formatPayAmount, formatPayShort, payPerHour, sortByBestPay } from "./pay";

const base = {
  currency: "ARS",
  start_at: "2026-09-26T20:00:00-03:00",
  end_at: "2026-09-26T23:00:00-03:00",
};

describe("payPerHour", () => {
  it("divide el pago por la duración", () => {
    expect(payPerHour({ ...base, pay_amount: "30000" })).toBe(10000);
  });

  it("null si la duración no es válida", () => {
    expect(payPerHour({ ...base, pay_amount: "30000", end_at: base.start_at })).toBeNull();
  });
});

describe("formatPayAmount / formatPayShort", () => {
  it("pesos con signo $ y separador de miles argentino", () => {
    expect(formatPayAmount({ pay_amount: "42000", currency: "ARS" })).toBe("$42.000");
  });

  it("otra moneda conserva el código", () => {
    expect(formatPayAmount({ pay_amount: "50", currency: "USD" })).toBe("USD 50");
  });

  it("suma '+ propinas' sólo si hay propinas", () => {
    expect(formatPayShort({ pay_amount: "42000", currency: "ARS", tips: true })).toBe("$42.000 + propinas");
    expect(formatPayShort({ pay_amount: "42000", currency: "ARS", tips: false })).toBe("$42.000");
  });
});

describe("sortByBestPay", () => {
  it("ordena por pago por hora, no por monto total", () => {
    const largo = { ...base, id: "largo", pay_amount: "40000", end_at: "2026-09-27T04:00:00-03:00" }; // 8 h → 5.000/h
    const corto = { ...base, id: "corto", pay_amount: "30000" }; // 3 h → 10.000/h
    expect(sortByBestPay([largo, corto]).map((s) => s.id)).toEqual(["corto", "largo"]);
  });

  it("los que no tienen duración válida van al final", () => {
    const roto = { ...base, id: "roto", pay_amount: "99999", end_at: base.start_at };
    const ok = { ...base, id: "ok", pay_amount: "30000" };
    expect(sortByBestPay([roto, ok]).map((s) => s.id)).toEqual(["ok", "roto"]);
  });
});
