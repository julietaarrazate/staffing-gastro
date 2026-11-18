import { describe, expect, it } from "vitest";
import { leerPedido } from "./pedido-natural";

describe("leerPedido", () => {
  it("lee el ejemplo de la landing", () => {
    expect(leerPedido("Necesito un mozo hoy de 21 a 2, pago 70.000")).toEqual({
      puesto: "Mozo/a",
      dia: "Hoy",
      horario: "21:00 – 02:00",
      pago: "$70.000",
    });
  });

  it("entiende cantidad, día de la semana y pago en miles", () => {
    expect(leerPedido("dos bartenders el sábado de 20 a 3, 80 mil")).toEqual({
      puesto: "Bartender",
      cantidad: 2,
      dia: "Sábado",
      horario: "20:00 – 03:00",
      pago: "$80.000",
    });
  });

  it("no confunde pasado mañana con mañana y acepta minutos", () => {
    const leido = leerPedido("una moza pasado mañana desde las 19:30 hasta las 23, $45000");
    expect(leido.dia).toBe("Pasado mañana");
    expect(leido.horario).toBe("19:30 – 23:00");
    expect(leido.pago).toBe("$45.000");
  });

  it("deja sin completar lo que no encuentra", () => {
    expect(leerPedido("hola, necesito alguien")).toEqual({});
  });

  it("«de la mañana» es la hora del día, no el día de mañana (U046)", () => {
    const leido = leerPedido("mozo el viernes de 21 hasta las 2 de la mañana, 70.000");
    expect(leido.dia).toBe("Viernes");
    expect(leido.horario).toBe("21:00 – 02:00");
    expect(leerPedido("necesito un cocinero el sábado a la mañana").dia).toBe("Sábado");
    expect(leerPedido("bachero hoy de 8 de la mañana a 4").dia).toBe("Hoy");
  });

  it("sin otro día, «de la mañana» no inventa un día", () => {
    expect(leerPedido("barista de 7 a 11 de la mañana").dia).toBeUndefined();
  });

  it("«mañana» suelto sigue siendo mañana", () => {
    expect(leerPedido("necesito un mozo mañana de 20 a 2").dia).toBe("Mañana");
    expect(leerPedido("mozo mañana a la mañana").dia).toBe("Mañana");
    expect(leerPedido("mozo mañana viernes").dia).toBe("Viernes");
  });
});
