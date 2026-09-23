import { describe, expect, it } from "vitest";
import type { Applicant } from "@/lib/types";
import { rankApplicants, standoutApplicant } from "./applicants";

function applicant(overrides: Partial<Applicant>): Applicant {
  return {
    application_id: "a",
    worker_profile_id: "w",
    full_name: "X",
    photo_url: null,
    rating: 0,
    is_available: true,
    status: "pendiente",
    created_at: "2026-09-22T10:00:00Z",
    events_completed: 0,
    punctuality_rate: 0,
    years_experience: 0,
    badges: [],
    level: "bronce",
    ...overrides,
  };
}

describe("rankApplicants", () => {
  it("pone primero a quien tiene turnos hechos, aunque se haya postulado último", () => {
    const nuevo = applicant({ full_name: "Nuevo", created_at: "2026-09-22T09:00:00Z" });
    const conHistorial = applicant({
      full_name: "Con historial",
      rating: 4.2,
      events_completed: 8,
      created_at: "2026-09-22T12:00:00Z",
    });
    expect(rankApplicants([nuevo, conHistorial]).map((a) => a.full_name)).toEqual(["Con historial", "Nuevo"]);
  });

  it("entre los que tienen historial, ordena por calificación y después puntualidad", () => {
    const a = applicant({ full_name: "A", rating: 4.6, punctuality_rate: 0.99, events_completed: 10 });
    const b = applicant({ full_name: "B", rating: 4.9, punctuality_rate: 0.9, events_completed: 3 });
    const c = applicant({ full_name: "C", rating: 4.6, punctuality_rate: 0.8, events_completed: 30 });
    expect(rankApplicants([a, b, c]).map((x) => x.full_name)).toEqual(["B", "A", "C"]);
  });

  it("a igualdad, respeta el orden de llegada", () => {
    const primero = applicant({ full_name: "Primero", created_at: "2026-09-22T09:00:00Z" });
    const segundo = applicant({ full_name: "Segundo", created_at: "2026-09-22T11:00:00Z" });
    expect(rankApplicants([segundo, primero]).map((x) => x.full_name)).toEqual(["Primero", "Segundo"]);
  });

  it("no modifica la lista original", () => {
    const list = [applicant({ full_name: "Z" }), applicant({ full_name: "Y", events_completed: 2 })];
    rankApplicants(list);
    expect(list.map((x) => x.full_name)).toEqual(["Z", "Y"]);
  });
});

describe("standoutApplicant", () => {
  it("no destaca a nadie si nadie tiene turnos hechos", () => {
    expect(standoutApplicant(rankApplicants([applicant({}), applicant({})]))).toBeNull();
  });

  it("destaca al primero cuando tiene historial", () => {
    const top = applicant({ full_name: "Top", events_completed: 5, rating: 4.8 });
    expect(standoutApplicant(rankApplicants([applicant({}), top]))?.full_name).toBe("Top");
  });
});
