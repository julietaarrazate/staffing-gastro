import { describe, expect, it } from "vitest";
import { formatShiftWhenLive } from "./datetime";
import { formatPayAmount, formatPayCompact, formatPayShort, payView } from "./pay";
import { nextStepFor } from "./shift-next-step";
import { buildShiftSummary } from "./shift-share";
import type { Shift } from "./types";
import {
  esperadoDesde,
  noShowConfirmCopy,
  puedeMarcarAusencia,
  reofferedHint,
  seReofrece,
} from "./turno-reofrecido";

// Turno de 20:00 a 24:00 (hora argentina) a $40.000: $10.000 por hora.
const turno = {
  pay_amount: "40000.00",
  currency: "ARS",
  start_at: "2026-11-18T20:00:00-03:00",
  end_at: "2026-11-19T00:00:00-03:00",
};
const reofrecido = { ...turno, reoffered_at: "2026-11-18T20:30:00-03:00", hourly_pay_amount: "10000" };
const conLlegada = { ...turno, reoffered_at: reofrecido.reoffered_at, prorated_pay_amount: "30000.00" };
const at = (hora: string) => new Date(`2026-11-18T${hora}:00-03:00`).getTime();

describe("payView: qué pago se muestra (U080)", () => {
  it("un turno común muestra su monto publicado, sin nota", () => {
    expect(payView(turno)).toEqual({ kind: "publicado", amount: "$40.000", suffix: null, note: null });
    expect(formatPayAmount(turno)).toBe("$40.000");
    expect(formatPayCompact(turno)).toBe("$40.000");
  });

  it("un reofrecido que nadie tomó muestra el valor por hora y dice que ya empezó", () => {
    const view = payView(reofrecido);
    expect(view.kind).toBe("por_hora");
    expect(view.amount).toBe("$10.000");
    expect(view.suffix).toBe("por hora");
    expect(view.note).toBe("Ya empezó · se paga desde que llegás");
    expect(formatPayAmount(reofrecido)).toBe("$10.000 por hora");
    expect(formatPayCompact(reofrecido)).toBe("$10.000/h");
    expect(formatPayShort({ ...reofrecido, tips: true })).toBe("$10.000 por hora + propinas");
  });

  it("con la llegada marcada muestra el monto que quedó fijo, nunca el publicado", () => {
    const view = payView(conLlegada);
    expect(view.kind).toBe("prorrateado");
    expect(view.amount).toBe("$30.000");
    expect(view.suffix).toBeNull();
    expect(view.note).toContain("desde la llegada");
    expect(formatPayAmount(conLlegada)).toBe("$30.000");
  });

  it("el monto fijo gana aunque la respuesta traiga también el valor por hora", () => {
    expect(payView({ ...conLlegada, hourly_pay_amount: "10000" }).kind).toBe("prorrateado");
  });

  it("los campos en null (un turno común que viene del backend nuevo) no cambian nada", () => {
    expect(payView({ ...turno, hourly_pay_amount: null, prorated_pay_amount: null }).kind).toBe("publicado");
  });
});

describe("formatShiftWhenLive", () => {
  it("un reofrecido por tomar dice que ya empezó y hasta cuándo", () => {
    expect(formatShiftWhenLive(reofrecido)).toBe("Ya empezó · hasta las 00:00");
  });

  it("cualquier otro turno muestra su horario de siempre", () => {
    expect(formatShiftWhenLive(turno, new Date(at("10:00")))).toBe("Hoy · 20:00 – 00:00");
    // Con la llegada marcada ya no se ofrece: horario normal.
    expect(formatShiftWhenLive(conLlegada, new Date(at("10:00")))).toBe("Hoy · 20:00 – 00:00");
  });
});

describe("compartir un turno reofrecido", () => {
  it("no invita a un horario que ya empezó y dice el valor por hora", () => {
    const texto = buildShiftSummary({ ...reofrecido, position: "mozo", city: "Palermo", company_name: "Bar Palermo" });
    expect(texto).toBe(
      "Buscamos Mozo/a para ahora, hasta las 00:00 en Bar Palermo, Palermo. Pago: $10.000 por hora, desde que llegás."
    );
  });
});

describe("el panel del comercio", () => {
  it("la línea del turno reofrecido dice hasta cuándo se ofrece", () => {
    const shift = { ...reofrecido, status: "buscando_personal" } as Shift;
    // Se ofrece mientras le queden 2 horas: hasta las 22:00 de un turno que
    // termina a las 00:00.
    expect(reofferedHint(shift)).toBe("Reofrecido como urgente hasta las 22:00 (dos horas antes del final).");
    const step = nextStepFor(shift);
    expect(step.hint).toBe("Reofrecido como urgente hasta las 22:00 (dos horas antes del final).");
    expect(step.action).toBe("candidates");
  });

  it("un turno abierto común sigue sin línea", () => {
    expect(nextStepFor({ ...turno, status: "buscando_personal" } as Shift).hint).toBe("");
    expect(nextStepFor({ ...turno, reoffered_at: null, status: "buscando_personal" } as Shift).hint).toBe("");
  });

  it("«¿Marcar que no se presentó?» dice que se reofrece si queda horario de sobra", () => {
    const copy = noShowConfirmCopy(turno, at("20:20"));
    expect(copy).toContain("lo reofrecemos como urgente hasta las 22:00, dos horas antes del final");
    expect(copy).toContain("cobra lo que reste desde que llegue");
    expect(copy).toContain("le va a impactar la reputación");
  });

  it("y que queda sin cubrir si queda poco horario", () => {
    const copy = noShowConfirmCopy(turno, at("22:20"));
    expect(copy).toContain("Queda poco horario (menos de 2 horas y 15 minutos)");
    expect(copy).toContain("«no cubierto»");
    expect(copy).not.toContain("reofrecemos");
  });

  it("a menos de 15 minutos del umbral, dice las dos posibilidades", () => {
    // El umbral es 21:45 (2 h + 15 min antes del fin): lo decide la hora del
    // servidor al marcarlo.
    for (const hora of ["21:35", "21:45", "21:55"]) {
      const copy = noShowConfirmCopy(turno, at(hora));
      expect(copy).toContain("si al marcarlo le quedan más de 2 horas y 15 minutos de horario lo reofrecemos");
      expect(copy).toContain("hasta las 22:00");
      expect(copy).toContain("si no, pasa a «no cubierto»");
      expect(copy).toContain("le va a impactar la reputación");
    }
  });

  it("a 15 minutos justos del umbral ya dice una sola cosa", () => {
    expect(noShowConfirmCopy(turno, at("21:30"))).toContain("lo reofrecemos como urgente hasta las 22:00,");
    expect(noShowConfirmCopy(turno, at("22:00"))).toContain("Queda poco horario");
    expect(noShowConfirmCopy(turno, at("22:00"))).not.toContain("si al marcarlo");
  });

  it("se reofrece con más de 2 h 15 min de horario, igual que en el servidor", () => {
    expect(seReofrece(turno, at("21:45") - 1000)).toBe(true);
    expect(seReofrece(turno, at("21:45"))).toBe(false);
    expect(seReofrece(turno, at("22:00"))).toBe(false);
  });
});

describe("desde cuándo se puede marcar la ausencia", () => {
  it("a quien confirmó antes de empezar, 15 minutos después del inicio", () => {
    const shift = { ...turno, confirmed_at: "2026-11-17T12:00:00-03:00" };
    expect(esperadoDesde(shift)).toBe(at("20:00"));
    expect(puedeMarcarAusencia(shift, at("20:14"))).toBe(false);
    expect(puedeMarcarAusencia(shift, at("20:15"))).toBe(true);
  });

  it("al reemplazo que confirmó con el turno empezado, 15 minutos después de confirmar", () => {
    const shift = { ...reofrecido, confirmed_at: "2026-11-18T21:10:00-03:00" };
    expect(esperadoDesde(shift)).toBe(at("21:10"));
    expect(puedeMarcarAusencia(shift, at("21:20"))).toBe(false);
    expect(puedeMarcarAusencia(shift, at("21:25"))).toBe(true);
  });

  it("en un turno común que se confirmó tarde, igual desde el inicio", () => {
    const shift = { ...turno, reoffered_at: null, confirmed_at: "2026-11-18T20:30:00-03:00" };
    expect(esperadoDesde(shift)).toBe(at("20:00"));
    expect(puedeMarcarAusencia(shift, at("20:14"))).toBe(false);
    expect(puedeMarcarAusencia(shift, at("20:15"))).toBe(true);
  });

  it("sin la marca de confirmación (turnos viejos, respuestas sin el campo) cuenta el inicio", () => {
    expect(puedeMarcarAusencia(turno, at("20:15"))).toBe(true);
    expect(puedeMarcarAusencia({ ...turno, confirmed_at: null }, at("20:14"))).toBe(false);
    expect(puedeMarcarAusencia({ ...turno, confirmed_at: "no es una fecha" }, at("20:15"))).toBe(true);
  });
});
