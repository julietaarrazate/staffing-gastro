import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ inView: true, reduced: false }));
vi.mock("motion/react", () => ({
  useInView: () => motion.inView,
  useReducedMotion: () => motion.reduced,
}));

import CountUp from "./CountUp";

describe("CountUp", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    motion.inView = true;
    motion.reduced = false;
  });
  afterEach(() => vi.useRealTimers());

  it("cuenta de 0 al valor, con el formato argentino", () => {
    render(<CountUp value={80000} duration={800} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText("80.000")).toBeInTheDocument();
  });

  it("no arranca hasta entrar en pantalla", () => {
    motion.inView = false;
    render(<CountUp value={12} />);
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("con reducir movimiento muestra el valor final de entrada", () => {
    motion.reduced = true;
    render(<CountUp value={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("si el valor cambia después de contado, sigue desde el anterior", () => {
    const { rerender } = render(<CountUp value={2} duration={100} />);
    act(() => vi.advanceTimersByTime(200));
    rerender(<CountUp value={5} duration={100} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
