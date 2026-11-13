import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidateStatChips, type CandidateSignals } from "./CandidateSignals";

const base: CandidateSignals = {
  rating: 0,
  events_completed: 0,
  punctuality_rate: 0,
  years_experience: 0,
};

describe("CandidateStatChips: sin reseñas no es cero", () => {
  it("persona nueva: «Nuevo en Oído», sin nota ni puntualidad", () => {
    const { container } = render(<CandidateStatChips signals={base} />);
    expect(screen.getByText("Nuevo en Oído")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0,0|0%|puntual/);
  });

  it("con turnos pero sin reseñas: no aparece 0,0 ni «Nuevo en Oído»", () => {
    const { container } = render(
      <CandidateStatChips signals={{ ...base, events_completed: 2, punctuality_rate: 1 }} />
    );
    expect(container.textContent).not.toContain("0,0");
    expect(screen.queryByText("Nuevo en Oído")).toBeNull();
    expect(screen.getByText("2 turnos")).toBeInTheDocument();
    expect(screen.getByText("100% puntual")).toBeInTheDocument();
  });

  it("con historial: nota con coma, turnos y puntualidad", () => {
    render(
      <CandidateStatChips
        signals={{ ...base, rating: 4.6, events_completed: 12, punctuality_rate: 0.95 }}
      />
    );
    expect(screen.getByText("4,6")).toBeInTheDocument();
    expect(screen.getByText("12 turnos")).toBeInTheDocument();
    expect(screen.getByText("95% puntual")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo en Oído")).toBeNull();
  });
});
