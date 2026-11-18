import { describe, expect, it } from "vitest";
import {
  formatSecret,
  isCompleteCode,
  isTwoFactorChallenge,
  recoveryCodesText,
  sanitizeAppCode,
} from "@/lib/two-factor";

describe("verificación en dos pasos", () => {
  it("reconoce el desafío del login y no confunde una sesión", () => {
    expect(
      isTwoFactorChallenge({ two_factor_required: true, challenge_token: "t", expires_in: 300 })
    ).toBe(true);
    expect(isTwoFactorChallenge({ access_token: "a", user: {} })).toBe(false);
    expect(isTwoFactorChallenge({ requires_role: true })).toBe(false);
    expect(isTwoFactorChallenge(null)).toBe(false);
  });

  it("muestra la clave en grupos de 4", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe(
      "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP"
    );
  });

  it("el campo de la app sólo deja 6 dígitos", () => {
    expect(sanitizeAppCode("12 34-56 78")).toBe("123456");
    expect(sanitizeAppCode("abc")).toBe("");
  });

  it("sabe cuándo el código está completo", () => {
    expect(isCompleteCode("123456", "app")).toBe(true);
    expect(isCompleteCode("12345", "app")).toBe(false);
    expect(isCompleteCode("abcd-efgh-jkmn", "recovery")).toBe(true);
    expect(isCompleteCode("ABCD EFGH JKMN", "recovery")).toBe(true);
    expect(isCompleteCode("abcd-efgh", "recovery")).toBe(false);
  });

  it("el .txt lleva la cuenta, la fecha y un código por línea", () => {
    const text = recoveryCodesText(
      ["aaaa-bbbb-cccc", "dddd-eeee-ffff"],
      "hola@oido.com.ar",
      new Date("2026-10-23T15:00:00Z")
    );
    expect(text).toContain("Cuenta: hola@oido.com.ar");
    expect(text).toContain("Generados el 23/10/2026");
    expect(text.split("\n")).toEqual(expect.arrayContaining(["aaaa-bbbb-cccc", "dddd-eeee-ffff"]));
  });
});
