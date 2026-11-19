import { describe, expect, it } from "vitest";
import {
  PASOS,
  RESPUESTAS_VACIAS,
  armarPedido,
  faltaEnPaso,
  filasDeDistribucion,
  limpiarRef,
  tieneContacto,
  TEAM_MODELS,
  type Respuestas,
} from "@/lib/encuesta";

const r = (extra: Partial<Respuestas>): Respuestas => ({ ...RESPUESTAS_VACIAS, ...extra });

describe("faltaEnPaso", () => {
  it("el rol, el nombre del local y el barrio son obligatorios", () => {
    expect(faltaEnPaso("rol", r({}))).toMatch(/Elegí/);
    expect(faltaEnPaso("rol", r({ respondentRole: "dueno" }))).toBeNull();
    expect(faltaEnPaso("local", r({ businessName: "  " }))).toMatch(/nombre del local/);
    expect(faltaEnPaso("local", r({ businessName: "Lo de Ana" }))).toBeNull();
    expect(faltaEnPaso("barrio", r({}))).toMatch(/barrio/);
    expect(faltaEnPaso("barrio", r({ barrio: "Palermo" }))).toBeNull();
  });

  it("las preguntas de una opción piden elegir", () => {
    expect(faltaEnPaso("tipo", r({}))).toMatch(/Elegí/);
    expect(faltaEnPaso("tipo", r({ localKind: "bar" }))).toBeNull();
    expect(faltaEnPaso("precio", r({}))).not.toBeNull();
    expect(faltaEnPaso("mes_fuerte", r({ eventualsPeak: "0" }))).toBeNull();
  });

  it("puestos, canales y ausencia son opcionales", () => {
    for (const paso of ["puestos", "canales", "ausencia"] as const) {
      expect(faltaEnPaso(paso, r({}))).toBeNull();
    }
  });

  it("el pago es opcional pero, si está, entra en el rango", () => {
    expect(faltaEnPaso("pago", r({ pago: "" }))).toBeNull();
    expect(faltaEnPaso("pago", r({ pago: "40000" }))).toBeNull();
    expect(faltaEnPaso("pago", r({ pago: "300" }))).toMatch(/entre/);
    expect(faltaEnPaso("pago", r({ pago: "2000000" }))).toMatch(/entre/);
  });

  it("el contacto sin datos deja seguir", () => {
    expect(faltaEnPaso("contacto", r({}))).toBeNull();
  });

  it("sumarse a la beta pide teléfono o email", () => {
    expect(faltaEnPaso("contacto", r({ wantsBeta: true }))).toMatch(/teléfono o un email/);
    expect(
      faltaEnPaso("contacto", r({ wantsBeta: true, phone: "11 5555-0000", consent: true }))
    ).toBeNull();
  });

  it("cualquier dato de contacto exige el consentimiento", () => {
    expect(faltaEnPaso("contacto", r({ contactName: "Ana" }))).toMatch(/aceptás/);
    expect(faltaEnPaso("contacto", r({ contactName: "Ana", consent: true }))).toBeNull();
    // El nombre del local es obligatorio y no es un dato de contacto.
    expect(faltaEnPaso("contacto", r({ businessName: "Lo de Ana" }))).toBeNull();
  });

  it("avisa de un teléfono o un email que no sirven", () => {
    expect(faltaEnPaso("contacto", r({ phone: "123", consent: true }))).toMatch(/incompleto/);
    expect(faltaEnPaso("contacto", r({ email: "ana", consent: true }))).toMatch(/email/);
  });
});

describe("armarPedido", () => {
  it("manda lo contestado y deja afuera lo vacío", () => {
    const body = armarPedido(
      r({
        respondentRole: "encargado",
        businessName: " Lo de Ana ",
        localKind: "bar",
        teamModel: "mixto",
        eventualsNormal: "1-3",
        eventualsPeak: "4-10",
        pricing: "por_turno",
        roles: ["mozo"],
        pago: "40000",
        barrio: "  Palermo ",
      }),
      "grupo-palermo"
    );
    expect(body).toMatchObject({
      respondent_role: "encargado",
      business_name: "Lo de Ana",
      local_kind: "bar",
      barrio: "Palermo",
      pay_per_shift_ars: 40000,
      roles: ["mozo"],
      source: "grupo-palermo",
      consent: false,
      wants_beta: false,
    });
    expect(body.phone).toBeUndefined();
    expect(body.company_website).toBeUndefined();
  });

  it("el consentimiento sólo viaja si hay contacto", () => {
    expect(armarPedido(r({ consent: true }), null).consent).toBe(false);
    expect(armarPedido(r({ email: "a@b.com", consent: true }), null).consent).toBe(true);
  });
});

describe("limpiarRef", () => {
  it("deja un texto corto y seguro, o null", () => {
    expect(limpiarRef("Grupo Palermo!")).toBe("grupo-palermo-");
    expect(limpiarRef("   ")).toBeNull();
    expect(limpiarRef(null)).toBeNull();
    expect(limpiarRef("a".repeat(100))).toHaveLength(60);
  });
});

describe("el resto", () => {
  it("hay un paso de contacto al final", () => {
    expect(PASOS.at(-1)).toBe("contacto");
    expect(tieneContacto(r({ contactName: "Ana" }))).toBe(true);
    expect(tieneContacto(r({}))).toBe(false);
  });

  it("la distribución muestra todas las opciones, también con cero", () => {
    const filas = filasDeDistribucion({ mixto: 4, equipo_fijo: 2 }, TEAM_MODELS);
    expect(filas.map((f) => f.cantidad)).toEqual([2, 0, 4]);
    expect(filas[2].parte).toBe(1);
    expect(filas[0].parte).toBe(0.5);
  });
});
