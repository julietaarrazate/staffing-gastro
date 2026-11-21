import { describe, expect, it } from "vitest";
import {
  accionesDelPlanActual,
  planDestacado,
  BETA_SIN_TOPE_TEXT,
  endOfArgentinaDay,
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

describe("endOfArgentinaDay", () => {
  it("vence al terminar el día argentino, inclusive (23:59:59.999 ART = 02:59:59.999 UTC del día siguiente)", () => {
    expect(endOfArgentinaDay("2026-11-10")).toBe(Date.parse("2026-11-11T02:59:59.999Z"));
  });
  it("una fecha ilegible no vence", () => {
    expect(endOfArgentinaDay("basura")).toBeNull();
  });
});

describe("un solo ámbar en Mi plan (2026-11-21)", () => {
  const base = { status: "activa", max_turnos_mes: 5, turnos_usados_mes: 1, billing_enabled: true, can_publish: true, limite_exigido: true };
  const AHORA = Date.parse("2026-11-21T12:00:00-03:00");
  const PLANES = [
    { code: "pro", price_ars: "45000" },
    { code: "inicial", price_ars: 9900 },
    { code: "basico", price_ars: "20000" },
  ];

  it("sin nada que pedir, la tarjeta del plan actual no lleva acción", () => {
    expect(accionesDelPlanActual(base, AHORA, true)).toEqual({ pagar: false, alLimite: false, cercaDelLimite: false });
  });

  it("bloqueado (falta pagar): pide pagar, salvo que no se pueda pagar desde ahí", () => {
    const sub = { ...base, status: "pendiente", can_publish: false };
    expect(accionesDelPlanActual(sub, AHORA, true).pagar).toBe(true);
    expect(accionesDelPlanActual(sub, AHORA, false).pagar).toBe(false);
  });

  it("vencido en los días de gracia: pide pagar sólo si se renueva", () => {
    const vencido = { ...base, paid_until: "2026-11-20T00:00:00-03:00" };
    expect(accionesDelPlanActual(vencido, AHORA, true).pagar).toBe(true);
    expect(accionesDelPlanActual({ ...vencido, renews: false }, AHORA, true).pagar).toBe(false);
  });

  it("al límite y cerca del límite, sólo con el tope exigido", () => {
    expect(accionesDelPlanActual({ ...base, turnos_usados_mes: 5 }, AHORA, true).alLimite).toBe(true);
    expect(accionesDelPlanActual({ ...base, turnos_usados_mes: 4 }, AHORA, true).cercaDelLimite).toBe(true);
    expect(accionesDelPlanActual({ ...base, turnos_usados_mes: 9, limite_exigido: false }, AHORA, true)).toEqual({
      pagar: false,
      alLimite: false,
      cercaDelLimite: false,
    });
    expect(accionesDelPlanActual({ ...base, max_turnos_mes: null, turnos_usados_mes: 99 }, AHORA, true).alLimite).toBe(false);
  });

  it("el ámbar de la lista es el plan siguiente al actual, no todos los superiores", () => {
    expect(planDestacado(PLANES, 9900, false)).toBe("basico");
    expect(planDestacado(PLANES, 20000, false)).toBe("pro");
  });

  it("en el plan más caro, o con una acción arriba, ningún plan va en ámbar", () => {
    expect(planDestacado(PLANES, 45000, false)).toBeNull();
    expect(planDestacado(PLANES, 9900, true)).toBeNull();
  });
});
