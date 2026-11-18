import { beforeEach, describe, expect, it } from "vitest";
import { guardarAvisoMail, tomarAvisoMail } from "./aviso-mail";

describe("aviso del mail de confirmación", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("sin alta reciente no hay aviso", () => {
    expect(tomarAvisoMail()).toBe(false);
  });

  it("se muestra una sola vez", () => {
    guardarAvisoMail();
    expect(tomarAvisoMail()).toBe(true);
    expect(tomarAvisoMail()).toBe(false);
  });
});
