import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MasAdelante, { type FilaFutura } from "./MasAdelante";

afterEach(cleanup);

const fila = (i: number): FilaFutura => ({
  id: `t${i}`,
  clave: `2026-11-${String(22 + i).padStart(2, "0")}`,
  puesto: "Mozo",
  estado: "Confirmado",
  tono: "text-success-text",
  pago: "$ 40.000",
});

describe("MasAdelante", () => {
  it("sin filas no pinta nada", () => {
    const { container } = render(<MasAdelante filas={[]} onElegir={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("muestra tres y «Ver los N que siguen» despliega el resto", () => {
    render(<MasAdelante filas={[1, 2, 3, 4, 5].map(fila)} onElegir={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Ver los 2 que siguen" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Ver los/ })).toBeNull();
  });

  it("con cuatro dice «Ver el que sigue»; con tres o menos no ofrece nada", () => {
    render(<MasAdelante filas={[1, 2, 3, 4].map(fila)} onElegir={() => {}} />);
    expect(screen.getByRole("button", { name: "Ver el que sigue" })).toBeTruthy();
    cleanup();
    render(<MasAdelante filas={[1, 2, 3].map(fila)} onElegir={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Ver (el|los) / })).toBeNull();
  });

  it("tocar una fila avisa su día", () => {
    const onElegir = vi.fn();
    render(<MasAdelante filas={[fila(1)]} onElegir={onElegir} />);
    fireEvent.click(screen.getByRole("button", { name: /lun 23 nov, Mozo, Confirmado, \$ 40.000/ }));
    expect(onElegir).toHaveBeenCalledWith("2026-11-23");
  });
});
