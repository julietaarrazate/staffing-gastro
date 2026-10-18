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
});
