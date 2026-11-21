import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { Shift } from "@/lib/types";
import UrgentesRow from "./UrgentesRow";

const AHORA = new Date("2026-11-21T12:00:00-03:00");
const MIN = 60_000;

function turno(id: string, minutos: number, extra: Partial<Shift> = {}): Shift {
  return {
    id,
    position: "bartender",
    start_at: new Date(AHORA.getTime() + minutos * MIN).toISOString(),
    pay_amount: "25000",
    currency: "ARS",
    company_name: `Local ${id}`,
    ...extra,
  } as Shift;
}

const km = () => 1.2;

/** Cuántos `setInterval` hay vivos (vi.getTimerCount también cuenta los de React). */
let vivos: Set<number>;
function vigilarIntervalos() {
  vivos = new Set();
  const poner = window.setInterval.bind(window);
  const sacar = window.clearInterval.bind(window);
  vi.spyOn(window, "setInterval").mockImplementation(((f: TimerHandler, ms?: number) => {
    const id = poner(f, ms) as unknown as number;
    vivos.add(id);
    return id;
  }) as typeof window.setInterval);
  vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
    if (id !== undefined) vivos.delete(id);
    sacar(id);
  }) as typeof window.clearInterval);
}

beforeEach(() => {
  vi.useFakeTimers({ now: AHORA });
  vigilarIntervalos();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("UrgentesRow", () => {
  it("dibuja una región «Urgentes» con una tarjeta por turno, el que empieza antes primero", () => {
    render(<UrgentesRow shifts={[turno("b", 100), turno("a", 45), turno("c", 300)]} distanceOf={km} />);
    const region = screen.getByRole("region", { name: "Urgentes" });
    const enlaces = within(region).getAllByRole("link");
    expect(enlaces.map((e) => e.getAttribute("href"))).toEqual(["/turno/a", "/turno/b", "/turno/c"]);
    expect(within(region).getByText("Empieza en 45 min")).toBeInTheDocument();
    expect(within(region).getByText("Empieza en 1 h 40")).toBeInTheDocument();
    expect(within(region).getByText("Empieza en 5 h")).toBeInTheDocument();
  });

  it("cada tarjeta tiene un nombre accesible completo", () => {
    render(<UrgentesRow shifts={[turno("a", 100)]} distanceOf={km} />);
    const enlace = screen.getByRole("link");
    const nombre = enlace.getAttribute("aria-label") ?? "";
    expect(nombre).toMatch(/^Urgente, /);
    expect(nombre).toContain("Local a");
    expect(nombre).toContain("empieza en 1 h 40");
    expect(nombre).toContain("$25.000");
    expect(nombre).toContain("a 1,2 km");
  });

  it("sin turnos urgentes no dibuja nada (ni título)", () => {
    const { container } = render(<UrgentesRow shifts={[turno("lejos", 600), turno("ya", -5)]} distanceOf={km} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Urgentes")).not.toBeInTheDocument();
  });

  it("sin turnos en absoluto tampoco, y sin temporizador", () => {
    const { container } = render(<UrgentesRow shifts={[]} distanceOf={km} />);
    expect(container).toBeEmptyDOMElement();
    expect(vivos.size).toBe(0);
  });

  it("pasa un minuto: la cuenta baja sola y el turno que ya empezó sale de la fila", () => {
    render(<UrgentesRow shifts={[turno("a", 1), turno("b", 100)]} distanceOf={km} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("Empieza en 1 min")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Empieza en 1 min")).not.toBeInTheDocument();
    expect(screen.getByText("Empieza en 1 h 39")).toBeInTheDocument();
  });

  it("cuando sale el último, desaparece toda la sección", () => {
    const { container } = render(<UrgentesRow shifts={[turno("a", 1)]} distanceOf={km} />);
    expect(screen.getByRole("region", { name: "Urgentes" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("entra a la fila un turno que estaba justo afuera de las 6 h", () => {
    render(<UrgentesRow shifts={[turno("a", 6 * 60 + 1)]} distanceOf={km} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2 * MIN);
    });
    expect(screen.getByText("Empieza en 5 h 59")).toBeInTheDocument();
  });

  it("un solo temporizador para toda la fila, y se limpia al desmontar", () => {
    const { unmount } = render(
      <UrgentesRow shifts={[turno("a", 30), turno("b", 60), turno("c", 90)]} distanceOf={km} />,
    );
    expect(vivos.size).toBe(1);
    unmount();
    expect(vivos.size).toBe(0);
  });

  it("con la pestaña oculta se pausa, y al volver toma la hora de ese momento", () => {
    let estado: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => estado);
    render(<UrgentesRow shifts={[turno("a", 100)]} distanceOf={km} />);
    expect(vivos.size).toBe(1);

    estado = "hidden";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(vivos.size).toBe(0);

    // Pasan 30 minutos con la pestaña oculta: la pantalla no se movió.
    act(() => {
      vi.advanceTimersByTime(30 * MIN);
    });
    expect(screen.getByText("Empieza en 1 h 40")).toBeInTheDocument();

    estado = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("Empieza en 1 h 10")).toBeInTheDocument();
    expect(vivos.size).toBe(1);
  });

  it("el cambio de minuto no se anuncia: no hay regiones en vivo", () => {
    const { container } = render(<UrgentesRow shifts={[turno("a", 100)]} distanceOf={km} />);
    expect(container.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
  });

  it("el local sin nombre dice «Comercio» y sin distancia no sobra el separador", () => {
    render(<UrgentesRow shifts={[turno("a", 100, { company_name: null })]} distanceOf={() => null} />);
    expect(screen.getByText("Comercio")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("aria-label")).not.toMatch(/ a \d/);
  });
});
