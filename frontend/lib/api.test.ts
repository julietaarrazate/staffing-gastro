import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  backgroundApi,
  bindSessionToken,
  isTransientFailure,
  NetworkError,
  parseErrorDetail,
  renewSessionToken,
  resolveToken,
  setTwoFactorGateHandler,
  setUnauthorizedHandler,
} from "@/lib/api";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeaderOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

describe("token de la sesión", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    bindSessionToken("sesion");
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    bindSessionToken(null);
    setUnauthorizedHandler(null);
  });

  it("una pantalla que pasa el token de la sesión sale con el renovado", async () => {
    renewSessionToken("renovado");
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await api.get("/x", "sesion");

    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer renovado");
  });

  it("un token que no es el de la sesión sale tal cual", async () => {
    renewSessionToken("renovado");
    fetchMock.mockResolvedValue(jsonResponse(200));

    await api.get("/auth/me", "recien-logueado");

    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer recien-logueado");
  });

  it("resolveToken sirve al WebSocket el mismo token que a las requests", () => {
    renewSessionToken("renovado");
    expect(resolveToken("sesion")).toBe("renovado");
    expect(resolveToken("otro")).toBe("otro");
    expect(resolveToken(null)).toBeNull();
  });

  it("ante un 401 renueva una vez y reintenta", async () => {
    const renew = vi.fn(async () => {
      renewSessionToken("nuevo");
      return "nuevo";
    });
    setUnauthorizedHandler(renew);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Not authenticated" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await api.get<{ ok: boolean }>("/x", "sesion");

    expect(result).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe("Bearer nuevo");
  });

  it("varias requests con 401 a la vez comparten una sola renovación", async () => {
    let resolveRenew: (token: string) => void = () => {};
    const renew = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRenew = (token) => {
            renewSessionToken(token);
            resolve(token);
          };
        })
    );
    setUnauthorizedHandler(renew);
    fetchMock.mockImplementation(async (_url, init: RequestInit) =>
      (init.headers as Record<string, string>).Authorization === "Bearer nuevo"
        ? jsonResponse(200)
        : jsonResponse(401)
    );

    const pending = Promise.all([api.get("/a", "sesion"), api.get("/b", "sesion")]);
    await vi.waitFor(() => expect(renew).toHaveBeenCalled());
    resolveRenew("nuevo");
    await pending;

    expect(renew).toHaveBeenCalledTimes(1);
  });

  it("si no se puede renovar, el 401 llega a la pantalla", async () => {
    setUnauthorizedHandler(async () => null);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Not authenticated" }));

    await expect(api.get("/x", "sesion")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta en bucle si el token renovado también da 401", async () => {
    setUnauthorizedHandler(async () => "nuevo");
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(api.get("/x", "sesion")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un 401 con un token ajeno no dispara la renovación", async () => {
    const renew = vi.fn(async () => "nuevo");
    setUnauthorizedHandler(renew);
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(api.get("/x", "otro")).rejects.toBeInstanceOf(ApiError);
    expect(renew).not.toHaveBeenCalled();
  });
});

describe("isTransientFailure", () => {
  it("un backend que no está (sin red, timeout o arrancando en frío) es transitorio", () => {
    expect(isTransientFailure(new NetworkError("sin red"))).toBe(true);
    for (const status of [500, 502, 503, 504, 408, 429]) {
      expect(isTransientFailure(new ApiError(status, "x"))).toBe(true);
    }
  });

  it("un rechazo de auth o un error de negocio no es transitorio", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isTransientFailure(new ApiError(status, "x"))).toBe(false);
    }
    expect(isTransientFailure(new Error("otra cosa"))).toBe(false);
  });
});

describe("errores con código (verificación en dos pasos, ADR-0023)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setTwoFactorGateHandler(null);
  });

  it("lee el mensaje y el código del detail", () => {
    expect(parseErrorDetail("Credenciales inválidas")).toEqual({ message: "Credenciales inválidas" });
    expect(parseErrorDetail({ code: "two_factor_required", message: "Volvé a ingresar" })).toEqual({
      code: "two_factor_required",
      message: "Volvé a ingresar",
    });
    expect(parseErrorDetail([{ loc: ["body"], msg: "x" }])).toEqual({ message: "Revisá los datos." });
  });

  it("un 422 con tipo propio del backend muestra su mensaje", () => {
    expect(
      parseErrorDetail([{ type: "zona_requerida", loc: ["body"], msg: "Elegí la zona del evento" }])
    ).toEqual({ message: "Elegí la zona del evento" });
  });

  // La forma que manda de verdad el backend (`backend/app/main.py`,
  // `handle_validation_error`): `{type, loc, msg}` y, sólo si hay cotas
  // numéricas del esquema, `ctx` con ellas. Nunca `input` ni textos en `ctx`.
  describe("422 de Pydantic traducido por tipo", () => {
    const msg = (detail: unknown) => parseErrorDetail(detail).message;

    it("mail sin dominio (sin ctx: el backend no manda el motivo)", () => {
      expect(
        msg([
          {
            type: "value_error",
            loc: ["body", "email"],
            msg: "value is not a valid email address: The part after the @-sign is not valid. It should have a period.",
          },
        ])
      ).toBe("Mail: tiene que ser un mail válido");
    });

    it("texto largo y corto, con las cotas que manda el backend", () => {
      expect(
        msg([
          { type: "string_too_long", loc: ["body", "body"], msg: "String should have at most 2000 characters", ctx: { max_length: 2000 } },
        ])
      ).toBe("Mensaje: máximo 2000 caracteres");
      expect(
        msg([
          { type: "string_too_short", loc: ["body", "password"], msg: "String should have at least 8 characters", ctx: { min_length: 8 } },
        ])
      ).toBe("Contraseña: mínimo 8 caracteres");
      expect(
        msg([
          { type: "string_too_short", loc: ["body", "full_name"], msg: "String should have at least 1 character", ctx: { min_length: 1 } },
        ])
      ).toBe("Nombre: no puede estar vacío");
      expect(
        msg([{ type: "string_too_short", loc: ["body", "text"], msg: "String should have at least 3 characters", ctx: { min_length: 3 } }])
      ).toBe("Texto: mínimo 3 caracteres");
    });

    it("sin cotas (un backend viejo) no inventa: una contraseña corta no es «vacía»", () => {
      expect(msg([{ type: "string_too_short", loc: ["body", "password"], msg: "String should have at least 8 characters" }])).toBe(
        "Contraseña: es demasiado corto"
      );
      expect(msg([{ type: "string_too_long", loc: ["body", "body"], msg: "x" }])).toBe("Mensaje: es demasiado largo");
    });

    it("números: entre dos cotas cuando el campo tiene rango", () => {
      expect(
        msg([
          { type: "less_than_equal", loc: ["body", "roles", 0, "count"], msg: "Input should be less than or equal to 50", ctx: { le: 50 } },
        ])
      ).toBe("Cantidad: entre 1 y 50");
      expect(
        msg([
          { type: "greater_than_equal", loc: ["body", "years_experience"], msg: "x", ctx: { ge: 0 } },
        ])
      ).toBe("Años de experiencia: entre 0 y 80");
      expect(msg([{ type: "greater_than_equal", loc: ["body", "pay_amount"], msg: "x", ctx: { ge: 0 } }])).toBe("Pago: mínimo 0");
      expect(msg([{ type: "less_than_equal", loc: ["body", "latitude"], msg: "x", ctx: { le: 90 } }])).toBe("Máximo 90");
    });

    it("falta un dato, número ilegible, fecha ilegible", () => {
      expect(msg([{ type: "missing", loc: ["body", "email"], msg: "Field required" }])).toBe("Mail: falta completarlo");
      expect(msg([{ type: "int_parsing", loc: ["body", "years_experience"], msg: "Input should be a valid integer, unable to parse string as an integer" }])).toBe(
        "Años de experiencia: tiene que ser un número"
      );
      expect(msg([{ type: "datetime_from_date_parsing", loc: ["body", "start_at"], msg: "x" }])).toBe(
        "Inicio: tiene que ser una fecha válida"
      );
    });

    it("el texto de un validador nunca se muestra, aunque llegara en `ctx`", () => {
      expect(
        msg([
          {
            type: "value_error",
            loc: ["body", "photo_url"],
            msg: "Value error, La dirección tiene que empezar con https://",
            ctx: { error: "La dirección tiene que empezar con https://" },
          },
        ])
      ).toBe("Revisá los datos.");
    });

    it("varios errores se unen sin repetir; tipo desconocido es «Revisá los datos.»", () => {
      expect(
        msg([
          { type: "value_error", loc: ["body", "email"], msg: "x" },
          { type: "string_too_long", loc: ["body", "full_name"], msg: "x", ctx: { max_length: 255 } },
        ])
      ).toBe("Mail: tiene que ser un mail válido · Nombre: máximo 255 caracteres");
      const raro = msg([{ type: "tipo_nuevo", loc: ["body", "x"], msg: "Some English message" }]);
      expect(raro).toBe("Revisá los datos.");
      expect(msg([{ type: "value_error", loc: ["body", "x"], msg: "Value error, in English" }])).toBe("Revisá los datos.");
    });
  });

  it("un 403 del candado avisa al manejador y llega a la pantalla con su código", async () => {
    const gate = vi.fn();
    setTwoFactorGateHandler(gate);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        detail: { code: "two_factor_setup_required", message: "Activá la verificación" },
      })
    );
    const err = (await api.get("/admin/stats", "tok").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("two_factor_setup_required");
    expect(err.message).toBe("Activá la verificación");
    expect(gate).toHaveBeenCalledWith("two_factor_setup_required");
  });

  it("un pedido que la app hace por su cuenta no avisa al manejador, y el error le llega igual", async () => {
    const gate = vi.fn();
    setTwoFactorGateHandler(gate);
    const candado = () =>
      jsonResponse(403, {
        detail: { code: "two_factor_required", message: "Volvé a ingresar" },
      });
    fetchMock.mockImplementation(async () => candado());

    const alta = (await backgroundApi
      .post("/push/subscribe", { endpoint: "https://push.example/x" }, "tok")
      .catch((e) => e)) as ApiError;
    const baja = (await backgroundApi
      .del("/push/subscribe", { endpoint: "https://push.example/x" }, "tok")
      .catch((e) => e)) as ApiError;

    expect(alta.code).toBe("two_factor_required");
    expect(baja.code).toBe("two_factor_required");
    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual([
      "POST",
      "DELETE",
    ]);
    // Nadie pidió esto desde una pantalla: no puede llevar al alta ni cerrar
    // la sesión. El candado lo dispara el primer pedido que sí hace una.
    expect(gate).not.toHaveBeenCalled();
  });

  it("otros errores con código no tocan la sesión", async () => {
    const gate = vi.fn();
    setTwoFactorGateHandler(gate);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, {
        detail: { code: "two_factor_challenge_invalid", message: "El ingreso venció." },
      })
    );
    const err = (await api.post("/auth/2fa/verify", { code: "1" }).catch((e) => e)) as ApiError;
    expect(err.code).toBe("two_factor_challenge_invalid");
    expect(gate).not.toHaveBeenCalled();
  });
});
