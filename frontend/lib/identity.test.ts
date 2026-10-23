import { describe, expect, it } from "vitest";
import { evidenceLinkPath, isLinkStale } from "./identity";

describe("links de evidencias privadas (ADR-0021)", () => {
  it("arma la ruta del link por id de evidencia", () => {
    expect(evidenceLinkPath("ev-1")).toBe("/identity/evidences/ev-1/link");
  });

  it("un link con más de 30 segundos por delante sigue sirviendo", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(isLinkStale({ url: "https://x", expires_at: "2026-10-23T12:04:00Z" }, now)).toBe(
      false
    );
  });

  it("un link vencido o por vencer se pide de nuevo", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(isLinkStale({ url: "https://x", expires_at: "2026-10-23T12:00:20Z" }, now)).toBe(true);
    expect(isLinkStale({ url: "https://x", expires_at: "2026-10-23T11:59:00Z" }, now)).toBe(true);
  });

  it("una evidencia vieja todavía pública (sin vencimiento) no se vuelve a pedir", () => {
    expect(isLinkStale({ url: "https://x", expires_at: null })).toBe(false);
  });
});
