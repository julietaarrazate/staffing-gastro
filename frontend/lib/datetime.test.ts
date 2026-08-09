import { describe, expect, it } from "vitest";
import {
  argentinaISOToLocalInput,
  formatDuration,
  formatShiftDate,
  formatShiftRange,
  formatShiftTime,
  localInputToArgentinaISO,
  shiftDurationMinutes,
} from "./datetime";

describe("localInputToArgentinaISO", () => {
  it("agrega el offset -03:00 a un valor de <input type=datetime-local>", () => {
    expect(localInputToArgentinaISO("2026-06-22T20:00")).toBe("2026-06-22T20:00:00-03:00");
  });

  it("no duplica los segundos si ya vienen incluidos", () => {
    expect(localInputToArgentinaISO("2026-06-22T20:00:30")).toBe("2026-06-22T20:00:30-03:00");
  });

  it("string vacío pasa derecho (formulario sin completar)", () => {
    expect(localInputToArgentinaISO("")).toBe("");
  });
});

describe("argentinaISOToLocalInput", () => {
  it("es la inversa de localInputToArgentinaISO para un horario en ART", () => {
    const local = "2026-06-22T20:00";
    expect(argentinaISOToLocalInput(localInputToArgentinaISO(local))).toBe(local);
  });

  it("convierte cruzando la medianoche: 02:30 UTC es 23:30 del día anterior en ART (UTC-3)", () => {
    expect(argentinaISOToLocalInput("2026-06-23T02:30:00Z")).toBe("2026-06-22T23:30");
  });
});

describe("shiftDurationMinutes", () => {
  it("calcula la duración en minutos entre dos ISO con zona", () => {
    expect(
      shiftDurationMinutes("2026-06-22T20:00:00-03:00", "2026-06-22T23:30:00-03:00")
    ).toBe(210);
  });

  it("funciona cruzando la medianoche (turno nocturno)", () => {
    expect(
      shiftDurationMinutes("2026-06-22T23:00:00-03:00", "2026-06-23T03:00:00-03:00")
    ).toBe(240);
  });

  it("null si el fin no es posterior al inicio (mismo instante o al revés)", () => {
    expect(
      shiftDurationMinutes("2026-06-22T20:00:00-03:00", "2026-06-22T20:00:00-03:00")
    ).toBeNull();
    expect(
      shiftDurationMinutes("2026-06-22T23:00:00-03:00", "2026-06-22T20:00:00-03:00")
    ).toBeNull();
  });

  it("null ante una fecha inválida en cualquiera de los dos extremos", () => {
    expect(shiftDurationMinutes("no-es-una-fecha", "2026-06-22T20:00:00-03:00")).toBeNull();
    expect(shiftDurationMinutes("2026-06-22T20:00:00-03:00", "")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("0 minutos se muestra como '0 min', no como texto vacío", () => {
    expect(formatDuration(0)).toBe("0 min");
  });

  it("sólo minutos, por debajo de una hora", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("horas exactas, sin el '0 min' colgando", () => {
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(120)).toBe("2 h");
  });

  it("horas y minutos combinados", () => {
    expect(formatDuration(90)).toBe("1 h 30 min");
  });

  it("días, con singular/plural correcto", () => {
    expect(formatDuration(1_440)).toBe("1 día");
    expect(formatDuration(2_880)).toBe("2 días");
  });

  it("días + horas + minutos, los tres juntos", () => {
    expect(formatDuration(1_440 + 60 + 30)).toBe("1 día 1 h 30 min");
  });
});

describe("formatShiftRange", () => {
  it("mismo día: la fecha aparece una sola vez, unida con ' a '", () => {
    const start = "2026-06-22T20:00:00-03:00";
    const end = "2026-06-22T23:30:00-03:00";
    // Se arma con las mismas funciones exportadas (no se hardcodea el
    // formato de fecha/hora, que depende del locale del entorno) — lo que
    // importa acá es la lógica de "no repetir la fecha si es el mismo día".
    const expected = `${formatShiftDate(start)} · ${formatShiftTime(start)} a ${formatShiftTime(end)}`;
    expect(formatShiftRange(start, end)).toBe(expected);
    expect(formatShiftRange(start, end)).not.toContain("→");
  });

  it("cruza de día: la fecha de fin también se muestra, unida con '→'", () => {
    const start = "2026-06-22T23:00:00-03:00";
    const end = "2026-06-23T03:00:00-03:00";
    const expected = `${formatShiftDate(start)} ${formatShiftTime(start)} → ${formatShiftDate(end)} ${formatShiftTime(end)}`;
    expect(formatShiftRange(start, end)).toBe(expected);
  });
});
