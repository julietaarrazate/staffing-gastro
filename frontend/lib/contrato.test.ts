import { describe, expect, it } from "vitest";
import contrato from "../e2e/contrato/respuestas.json";
import { deContrato, fulfillContrato, respuesta, statusDe } from "../e2e/contrato";
import {
  STATUS_LABELS,
  type Applicant,
  type CandidateMatch,
  type CompanyProfile,
  type Notification,
  type Shift,
  type ShiftApplication,
  type ShiftPublic,
  type Subscription,
  type User,
  type WeeklyMetrics,
  type WorkerProfile,
} from "./types";

/**
 * Contrato backend <-> frontend (ver e2e/contrato/README.md).
 *
 * Los tipos de `types.ts` prometen campos; el JSON de `e2e/contrato` es lo que
 * el backend manda de verdad. Si un tipo exige un campo que el backend no manda
 * (o con otro tipo), `tsc --noEmit` falla en este archivo. JSON no distingue
 * las uniones de strings (`ShiftStatus`), así que se comparan con el tipo
 * «ensanchado»: los literales cuentan como `string`. Las uniones se revisan
 * abajo, en runtime.
 */
type Ensanchar<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Ensanchar<U>[]
    : T extends object
      ? { [K in keyof T]: Ensanchar<T[K]> }
      : T;

describe("los tipos del frontend calzan con lo que manda el backend", () => {
  it("sesión: /auth/me y login", () => {
    const worker: Ensanchar<User> = contrato.auth_me_worker.body;
    const comercio: Ensanchar<User> = contrato.auth_me_employer.body;
    const admin: Ensanchar<User> = contrato.auth_me_admin_sin_dos_pasos.body;
    const login: Ensanchar<User> = contrato.login.body.user;
    expect([worker.role, comercio.role, admin.role, login.role]).toEqual([
      "worker",
      "employer",
      "admin",
      "employer",
    ]);
  });

  it("turno: cada estado que captura el contrato", () => {
    const turnos: Ensanchar<Shift>[] = [
      contrato.turno_crear.body,
      contrato.turno_borrador_comercio.body,
      contrato.turno_publicar.body,
      contrato.turno_publicado_comercio.body,
      contrato.turno_publicado_trabajador.body,
      contrato.turno_asignar.body,
      contrato.turno_asignado_comercio.body,
      contrato.turno_confirmar.body,
      contrato.turno_confirmado_trabajador.body,
      contrato.turno_en_camino.body,
      contrato.turno_en_camino_comercio.body,
      contrato.turno_cancelar.body,
      ...contrato.feed.body,
      ...contrato.turnos_del_comercio.body,
      ...contrato.turnos_del_comercio_con_asignado.body,
      ...contrato.turnos_asignados_trabajador.body,
    ];
    expect(turnos.length).toBeGreaterThan(12);
    for (const t of turnos) expect(Object.keys(STATUS_LABELS)).toContain(t.status);
  });

  it("turno público", () => {
    const publico: Ensanchar<ShiftPublic> = contrato.turno_publico.body;
    expect(publico.id).toBe("shift-1");
  });

  it("postulaciones y postulantes", () => {
    const mias: Ensanchar<ShiftApplication>[] = contrato.postulaciones_mias.body;
    const nueva: Ensanchar<ShiftApplication> = contrato.postular.body;
    const postulantes: Ensanchar<Applicant>[] = contrato.postulantes.body;
    expect(mias.length).toBeGreaterThan(0);
    expect(postulantes.length).toBe(2);
    expect(nueva.status).toBe("pendiente");
  });

  it("candidatos recomendados", () => {
    const candidatos: Ensanchar<CandidateMatch>[] = contrato.candidatos_recomendados.body;
    expect(candidatos.length).toBe(2);
  });

  it("perfiles", () => {
    const trabajador: Ensanchar<WorkerProfile> = contrato.perfil_trabajador.body;
    const comercio: Ensanchar<CompanyProfile> = contrato.perfil_comercio.body;
    expect(trabajador.skills).toEqual(["mozo"]);
    expect(comercio.name).toBe("Bar Palermo");
  });

  it("avisos", () => {
    const avisos: Ensanchar<Notification>[] = [
      ...contrato.avisos_comercio.body,
      ...contrato.avisos_trabajador.body,
    ];
    expect(avisos.length).toBeGreaterThan(1);
  });

  it("plan del comercio", () => {
    const plan: Ensanchar<Subscription> = contrato.suscripcion_comercio.body;
    expect(plan.plan_code).toBeTruthy();
  });

  it("métricas: la serie semanal M7", () => {
    const serie: Ensanchar<WeeklyMetrics> = contrato.metricas_semanales.body;
    expect(serie.weeks[0].signups_by_origin.length).toBeGreaterThan(0);
  });
});

describe("deContrato", () => {
  it("pisa valores sobre la respuesta real", () => {
    const t = deContrato("turno_confirmado_trabajador", { status: "cancelado", city: "Recoleta" });
    expect(t.status).toBe("cancelado");
    expect(t.city).toBe("Recoleta");
    expect(t.company_name).toBe("Bar Palermo");
  });

  it("rechaza una clave que el backend no manda", () => {
    expect(() => deContrato("turno_confirmado_trabajador", { inventado: 1 })).toThrow(/inventado/);
  });

  it("rechaza una clave inventada en un objeto anidado", () => {
    expect(() =>
      deContrato("login", { user: { rol_inventado: "worker" } })
    ).toThrow(/user\.rol_inventado/);
  });

  it("valida cada elemento de una lista contra el primero real", () => {
    const lista = deContrato("turnos_asignados_trabajador", [{ status: "asignado" }, { status: "confirmado" }]);
    expect(lista.map((t) => t.status)).toEqual(["asignado", "confirmado"]);
    expect(() => deContrato("turnos_asignados_trabajador", [{ inventado: 1 }])).toThrow(/\[0\]\.inventado/);
  });

  it("devuelve copias: modificar una no cambia el contrato", () => {
    const a = respuesta("turno_crear");
    a.city = "Otra";
    expect(respuesta("turno_crear").city).toBe("Palermo");
  });

  it("responde con el status real del escenario", async () => {
    expect(statusDe("turno_cancelado_confirmar")).toBe(400);
    let enviado: { status?: number; body?: string } = {};
    await fulfillContrato(
      { fulfill: async (o: typeof enviado) => (enviado = o) } as never,
      "turno_cancelado_confirmar"
    );
    expect(enviado.status).toBe(400);
    expect(JSON.parse(enviado.body ?? "{}").detail).toBe("El comercio canceló este turno.");
  });
});
