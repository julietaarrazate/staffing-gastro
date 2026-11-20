import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CandidateStatChips, datosCandidato, type CandidateSignals } from "./CandidateSignals";

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

describe("datosCandidato: los datos en pocas palabras (tarjeta y filas de Candidatos)", () => {
  it("persona nueva: sólo «Nuevo en Oído», sin nota ni puntualidad en cero", () => {
    expect(datosCandidato(base).map((d) => d.texto)).toEqual(["Nuevo en Oído"]);
  });

  it("con turnos pero sin reseñas: ni nota ni «Nuevo en Oído»", () => {
    const claves = datosCandidato({ ...base, events_completed: 1, punctuality_rate: 1 }).map((d) => d.clave);
    expect(claves).toEqual(["turnos", "puntual"]);
  });

  it("con todo: en orden de peso, con el número y su rótulo para mostrarlo grande", () => {
    const datos = datosCandidato({
      rating: 4.86,
      events_completed: 41,
      punctuality_rate: 0.97,
      years_experience: 1,
      distance_km: 1.2,
    });
    expect(datos.map((d) => d.texto)).toEqual(["4,9", "41 turnos", "A 1,2 km", "97% puntual", "1 año exp."]);
    expect(datos.map((d) => `${d.numero} ${d.rotulo}`)).toEqual([
      "4,9 de calificación",
      "41 turnos hechos",
      "1,2 km de tu local",
      "97% puntual",
      "1 año de oficio",
    ]);
  });

  it("un solo turno va en singular", () => {
    const turno = datosCandidato({ ...base, events_completed: 1 }).find((d) => d.clave === "turnos");
    expect(turno).toMatchObject({ texto: "1 turno", rotulo: "turno hecho" });
  });
});
