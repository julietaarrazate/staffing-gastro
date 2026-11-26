import { describe, expect, it } from "vitest";
import type { Applicant } from "@/lib/types";
import {
  activeApplicantCount,
  motivosDe,
  rotuloDelPrimero,
  unassignedLabel,
} from "./applicants";

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
    identidad_verificada: false,
    es_favorito: false,
    trabajo_aca: false,
    turnos_en_el_puesto: 0,
    nuevo_verificado: false,
    ...overrides,
  };
}

// El orden lo decide el backend (ADR-0031): acá sólo se nombra por qué va
// primero quien encabeza la lista que llega.
describe("rotuloDelPrimero", () => {
  it("sin nadie, o sin un motivo con respaldo, no dice nada", () => {
    expect(rotuloDelPrimero([])).toBeNull();
    expect(rotuloDelPrimero([applicant({}), applicant({})])).toBeNull();
  });

  it("la confianza del local va antes que cualquier otro motivo", () => {
    const favorita = applicant({ es_favorito: true, trabajo_aca: true, events_completed: 9, rating: 5 });
    expect(rotuloDelPrimero([favorita])).toBe("Entre tus favoritos");
    expect(rotuloDelPrimero([applicant({ trabajo_aca: true })])).toBe("Ya trabajó en tu local");
  });

  it("dice «Mejor calificación» sólo si nadie en carrera la supera", () => {
    const primero = applicant({ events_completed: 5, rating: 4.6, turnos_en_el_puesto: 5 });
    const mejorValorada = applicant({ events_completed: 9, rating: 4.9 });
    const sinTurnos = applicant({ rating: 5 });
    expect(rotuloDelPrimero([primero, sinTurnos])).toBe("Mejor calificación");
    expect(rotuloDelPrimero([primero, mejorValorada])).toBe("Con experiencia en el puesto");
  });

  it("no cuenta la calificación de quien ya tuvo el turno y lo dejó", () => {
    const primero = applicant({ events_completed: 5, rating: 4.6 });
    const loDejo = applicant({ status: "desasignada", motivo: "rechazo", events_completed: 40, rating: 5 });
    expect(rotuloDelPrimero([primero, loDejo])).toBe("Mejor calificación");
  });
});

describe("motivosDe", () => {
  it("sin vínculo ni experiencia en el puesto, no dice nada", () => {
    expect(motivosDe(applicant({ events_completed: 9, rating: 5 }))).toEqual([]);
  });

  it("nombra la confianza del local y los turnos en el puesto, en ese orden", () => {
    expect(motivosDe(applicant({ es_favorito: true, trabajo_aca: true, turnos_en_el_puesto: 3 }))).toEqual([
      "Entre tus favoritos",
      "Ya trabajó en tu local",
      "3 turnos en este puesto",
    ]);
    expect(motivosDe(applicant({ turnos_en_el_puesto: 1 }))).toEqual(["1 turno en este puesto"]);
  });

  it("quien tuvo el turno y lo dejó no lleva motivos", () => {
    expect(motivosDe(applicant({ status: "desasignada", es_favorito: true, turnos_en_el_puesto: 5 }))).toEqual([]);
  });
});

describe("quien tuvo el turno y lo dejó (G4)", () => {
  const crack = applicant({
    application_id: "crack",
    full_name: "Crack que rechazó",
    status: "desasignada",
    motivo: "rechazo",
    rating: 5,
    events_completed: 40,
    punctuality_rate: 1,
    es_favorito: true,
  });
  const nuevo = applicant({ application_id: "nuevo", full_name: "Nuevo" });

  it("nunca lleva el rótulo del primero, ni siquiera si es el único", () => {
    expect(rotuloDelPrimero([crack])).toBeNull();
  });

  it("no suma en la cuenta de postulantes", () => {
    expect(activeApplicantCount([crack, nuevo])).toBe(1);
    expect(activeApplicantCount([crack])).toBe(0);
  });

  it("lleva la marca de su motivo", () => {
    expect(unassignedLabel(crack)).toBe("Rechazó este turno");
    expect(unassignedLabel({ status: "desasignada", motivo: "cancelacion" })).toBe("Canceló");
    expect(unassignedLabel({ status: "desasignada", motivo: "ausencia" })).toBe("No se presentó");
    expect(unassignedLabel({ status: "desasignada", motivo: null })).toBe("Ya tuvo este turno");
  });

  it("un postulante en carrera no lleva marca", () => {
    expect(unassignedLabel(nuevo)).toBeNull();
    expect(unassignedLabel({ status: "aceptada", motivo: null })).toBeNull();
  });
});
