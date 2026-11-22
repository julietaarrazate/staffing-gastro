import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE_RECARGADO,
  debeRecargar,
  estaEscribiendo,
  marcarRecargadoPor,
  pedirVersionRemota,
} from "./version-app";

describe("debeRecargar", () => {
  it("no recarga si las versiones son iguales", () => {
    expect(debeRecargar({ local: "a", remota: "a", yaRecargadoPor: null })).toBe(false);
  });
  it("recarga si difieren", () => {
    expect(debeRecargar({ local: "a", remota: "b", yaRecargadoPor: null })).toBe(true);
  });
  it("no recarga dos veces por la misma versión", () => {
    expect(debeRecargar({ local: "a", remota: "b", yaRecargadoPor: "b" })).toBe(false);
  });
  it("recarga si salió otra versión distinta a la ya recargada", () => {
    expect(debeRecargar({ local: "a", remota: "c", yaRecargadoPor: "b" })).toBe(true);
  });
  it("no recarga sin versión local o remota", () => {
    expect(debeRecargar({ local: "", remota: "b", yaRecargadoPor: null })).toBe(false);
    expect(debeRecargar({ local: "a", remota: null, yaRecargadoPor: null })).toBe(false);
  });
});

describe("marcarRecargadoPor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  it("guarda la marca", () => {
    expect(marcarRecargadoPor("b")).toBe(true);
    expect(sessionStorage.getItem(CLAVE_RECARGADO)).toBe("b");
  });
  it("devuelve false si sessionStorage falla (no hay anti-loop, no se recarga)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(marcarRecargadoPor("b")).toBe(false);
  });
});

describe("estaEscribiendo", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });
  it("detecta foco en un input", () => {
    document.body.innerHTML = "<input id='x'>";
    (document.getElementById("x") as HTMLInputElement).focus();
    expect(estaEscribiendo()).toBe(true);
  });
  it("false sin foco en campos", () => {
    document.body.innerHTML = "<button id='b'>ok</button>";
    (document.getElementById("b") as HTMLButtonElement).focus();
    expect(estaEscribiendo()).toBe(false);
  });
});

describe("pedirVersionRemota", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("lee la versión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "v2" }) }));
    expect(await pedirVersionRemota()).toBe("v2");
  });
  it("devuelve null si falla la red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await pedirVersionRemota()).toBeNull();
  });
});
