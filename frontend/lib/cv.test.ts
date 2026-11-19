import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a) } }));

import { cvLinkPath, openCv } from "./cv";

const LINK = "https://api.cloudinary.com/v1_1/oido/image/download?public_id=x&expires_at=1";

describe("el CV se abre con un link que vence (ADR-0021)", () => {
  let tab: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };
  const assign = vi.fn();

  beforeEach(() => {
    apiGet.mockReset();
    assign.mockReset();
    tab = { opener: window, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pide el link al backend y lo carga en la pestaña que abrió al tocar", async () => {
    apiGet.mockResolvedValue({ url: LINK, expires_at: "2026-11-19T12:05:00Z" });

    expect(await openCv("wp-1", "tok")).toBe(true);

    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(apiGet).toHaveBeenCalledWith("/workers/wp-1/cv-link", "tok");
    expect(tab.location.href).toBe(LINK);
    expect(tab.opener).toBeNull();
  });

  it("para bajarlo no abre otra pestaña y pide el adjunto", async () => {
    apiGet.mockResolvedValue({ url: LINK, expires_at: null });

    expect(await openCv("wp-1", "tok", true)).toBe(true);

    expect(window.open).not.toHaveBeenCalled();
    expect(apiGet).toHaveBeenCalledWith("/workers/wp-1/cv-link?download=true", "tok");
    expect(assign).toHaveBeenCalledWith(LINK);
  });

  it("si el link no llega, cierra la pestaña y avisa", async () => {
    apiGet.mockRejectedValue(new Error("404"));
    expect(await openCv("wp-1", "tok")).toBe(false);
    expect(tab.close).toHaveBeenCalled();
  });

  it("no carga algo que no sea https", async () => {
    apiGet.mockResolvedValue({ url: "javascript:alert(1)", expires_at: null });
    expect(await openCv("wp-1", "tok")).toBe(false);
    expect(tab.location.href).toBe("");
  });

  it("el id va escapado en la ruta", () => {
    expect(cvLinkPath("a/b")).toBe("/workers/a%2Fb/cv-link");
  });
});
