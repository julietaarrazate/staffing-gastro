import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SemanaTira from "./SemanaTira";
import { semanaArgentina, turnosPorDia } from "@/lib/semana";

afterEach(cleanup);

// Jueves 19/11/2026, 15:00 en Argentina: la semana del 16 al 22.
const AHORA = new Date("2026-11-19T18:00:00Z");
const TURNOS = turnosPorDia(["2026-11-18", "2026-11-18", "2026-11-21"]);

function armar(props: Partial<React.ComponentProps<typeof SemanaTira>> = {}) {
  const onElegir = vi.fn();
  const onSemana = vi.fn();
  const onVolver = vi.fn();
  render(
    <SemanaTira
      dias={semanaArgentina(AHORA)}
      turnosPorDia={TURNOS}
      elegido={null}
      onElegir={onElegir}
      onSemana={onSemana}
      esActual
      onVolver={onVolver}
      {...props}
    />,
  );
  return { onElegir, onSemana, onVolver };
}

describe("SemanaTira", () => {
  it("pinta siete días de lunes a domingo, cada uno un botón con su nombre completo", () => {
    armar();
    const dias = within(screen.getByRole("list", { name: "Días de la semana" })).getAllByRole("button");
    expect(dias.map((b) => b.getAttribute("aria-label"))).toEqual([
      "lunes 16",
      "martes 17",
      "miércoles 18, 2 turnos",
      "jueves 19, hoy",
      "viernes 20",
      "sábado 21, 1 turno",
      "domingo 22",
    ]);
    expect(screen.getByText("Esta semana · 16 – 22 nov")).toBeTruthy();
  });

  it("pone el puntito sólo en los días con turnos", () => {
    armar();
    const con = [...document.querySelectorAll("[data-dia]")].filter((li) => li.querySelector("[data-con-turno]"));
    expect(con.map((li) => li.getAttribute("data-dia"))).toEqual(["2026-11-18", "2026-11-21"]);
  });

  it("tocar un día lo elige; tocar el elegido lo suelta (aria-pressed)", () => {
    const { onElegir } = armar();
    fireEvent.click(screen.getByRole("button", { name: "miércoles 18, 2 turnos" }));
    expect(onElegir).toHaveBeenLastCalledWith("2026-11-18");
    cleanup();
    const otra = armar({ elegido: "2026-11-18" });
    const elegido = screen.getByRole("button", { name: "miércoles 18, 2 turnos" });
    expect(elegido.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "martes 17" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(elegido);
    expect(otra.onElegir).toHaveBeenLastCalledWith(null);
  });

  it("hoy sin elegir lleva el aro; elegido, la tecla blanca (hoy elegido no lleva aro)", () => {
    armar();
    expect(document.querySelectorAll(".dia-cielo-aro")).toHaveLength(1);
    expect(document.querySelectorAll(".dia-cielo-hoy")).toHaveLength(0);
    cleanup();
    armar({ elegido: "2026-11-17" });
    expect(document.querySelector('[data-dia="2026-11-17"] .dia-cielo-hoy')).toBeTruthy();
    expect(document.querySelector('[data-dia="2026-11-19"] .dia-cielo-aro')).toBeTruthy();
    cleanup();
    armar({ elegido: "2026-11-19" });
    expect(document.querySelector('[data-dia="2026-11-19"] .dia-cielo-hoy')).toBeTruthy();
    expect(document.querySelectorAll(".dia-cielo-aro")).toHaveLength(0);
  });

  it("las flechas avisan el paso y llevan puntito sólo si hay turnos de ese lado", () => {
    const { onSemana } = armar({ hayAntes: false, hayDespues: true });
    expect(document.querySelector('[data-punto="antes"]')).toBeNull();
    expect(document.querySelector('[data-punto="despues"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(onSemana).toHaveBeenLastCalledWith(-1);
    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente, con turnos" }));
    expect(onSemana).toHaveBeenLastCalledWith(1);
  });

  it("en la semana de hoy no ofrece «Volver»; en otra sí, con el rótulo sin «Esta»", () => {
    armar();
    expect(screen.queryByRole("button", { name: "Volver a esta semana" })).toBeNull();
    cleanup();
    const { onVolver } = armar({ dias: semanaArgentina(AHORA, 1), esActual: false });
    expect(screen.getByText("Semana · 23 – 29 nov")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver a esta semana" }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it("sin `onVolver` no muestra el chip aunque sea otra semana", () => {
    armar({ dias: semanaArgentina(AHORA, 1), esActual: false, onVolver: undefined });
    expect(screen.queryByRole("button", { name: "Volver a esta semana" })).toBeNull();
  });

  it("usada de punta a punta: elegir, soltar y cambiar de semana", () => {
    function Probar() {
      const [offset, setOffset] = useState(0);
      const [dia, setDia] = useState<string | null>(null);
      return (
        <SemanaTira
          dias={semanaArgentina(AHORA, offset)}
          turnosPorDia={TURNOS}
          elegido={dia}
          onElegir={setDia}
          onSemana={(p) => {
            setOffset((o) => o + p);
            setDia(null);
          }}
          esActual={offset === 0}
          onVolver={() => setOffset(0)}
        />
      );
    }
    render(<Probar />);
    const miercoles = () => screen.getByRole("button", { name: "miércoles 18, 2 turnos" });
    fireEvent.click(miercoles());
    expect(miercoles().getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(miercoles());
    expect(miercoles().getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(miercoles());
    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(screen.getByText("Semana · 23 – 29 nov")).toBeTruthy();
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a esta semana" }));
    expect(screen.getByText("Esta semana · 16 – 22 nov")).toBeTruthy();
  });
});
