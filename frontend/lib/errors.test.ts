import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { getErrorMessage, isNotFound, isPlanLimitError } from "./errors";

describe("getErrorMessage", () => {
  it("usa el mensaje del ApiError tal cual (ya viene en español del backend)", () => {
    expect(getErrorMessage(new ApiError(400, "El email ya está registrado"))).toBe(
      "El email ya está registrado"
    );
  });

  it("pisa cualquier otro error (p. ej. 'Failed to fetch') con el fallback por defecto", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "No pudimos conectar. Revisá tu conexión e intentá de nuevo."
    );
  });

  it("usa el fallback provisto en vez del genérico, si se pasa uno", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"), "No se pudo guardar")).toBe(
      "No se pudo guardar"
    );
  });

  it("también cubre valores que ni siquiera son Error (throw de algo raro)", () => {
    expect(getErrorMessage("string suelto", "Fallback")).toBe("Fallback");
    expect(getErrorMessage(undefined, "Fallback")).toBe("Fallback");
  });
});

describe("isNotFound", () => {
  it("true sólo para ApiError con status 404", () => {
    expect(isNotFound(new ApiError(404, "No encontrado"))).toBe(true);
  });

  it("false para otros status de ApiError", () => {
    expect(isNotFound(new ApiError(500, "Error de servidor"))).toBe(false);
    expect(isNotFound(new ApiError(400, "Bad request"))).toBe(false);
  });

  it("false para errores que no son ApiError", () => {
    expect(isNotFound(new Error("cualquier cosa"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("isPlanLimitError", () => {
  it("true sólo para ApiError 402 (límite de plan, ADR-0005)", () => {
    expect(isPlanLimitError(new ApiError(402, "Límite de plan alcanzado"))).toBe(true);
  });

  it("false para 403 (a propósito: puede ser un problema de permisos distinto)", () => {
    expect(isPlanLimitError(new ApiError(403, "Prohibido"))).toBe(false);
  });

  it("false para errores que no son ApiError", () => {
    expect(isPlanLimitError(new Error("cualquier cosa"))).toBe(false);
  });
});
