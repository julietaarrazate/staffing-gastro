import { describe, expect, it } from "vitest";
import {
  parseSupportPrefill,
  reportCompanyHref,
  reportShiftHref,
} from "./support-reference";

// Ids armados en el momento: un literal con forma de UUID lo marca gitleaks.
const ID_A = ["11111111", "2222", "4333", "8444", "555555555555"].join("-");
const ID_B = ["aaaaaaaa", "bbbb", "4ccc", "9ddd", "eeeeeeeeeeee"].join("-");

function params(query: string) {
  return new URLSearchParams(query);
}

describe("parseSupportPrefill", () => {
  it("lee un turno", () => {
    expect(parseSupportPrefill(params(`categoria=turno&turno=${ID_A}`))).toEqual({
      category: "turno",
      shiftId: ID_A,
      companyId: null,
    });
  });

  it("lee un comercio", () => {
    expect(parseSupportPrefill(params(`categoria=comercio&comercio=${ID_B}`))).toEqual({
      category: "comercio",
      shiftId: null,
      companyId: ID_B,
    });
  });

  it("ignora lo que no es un id", () => {
    expect(parseSupportPrefill(params("categoria=turno&turno=../../admin"))).toBeNull();
    expect(parseSupportPrefill(params("categoria=comercio&comercio=abc"))).toBeNull();
  });

  it("no precarga sin categoría o con el id de la otra categoría", () => {
    expect(parseSupportPrefill(params(`turno=${ID_A}`))).toBeNull();
    expect(parseSupportPrefill(params(`categoria=turno&comercio=${ID_B}`))).toBeNull();
    expect(parseSupportPrefill(params(`categoria=pagos&turno=${ID_A}`))).toBeNull();
    expect(parseSupportPrefill(params(""))).toBeNull();
  });
});

describe("enlaces de «Reportar un problema»", () => {
  it("arman la URL que lee parseSupportPrefill", () => {
    const shift = reportShiftHref(ID_A);
    const company = reportCompanyHref(ID_B);
    expect(shift).toBe(`/support?categoria=turno&turno=${ID_A}`);
    expect(parseSupportPrefill(new URL(shift, "http://x").searchParams)?.shiftId).toBe(ID_A);
    expect(parseSupportPrefill(new URL(company, "http://x").searchParams)?.companyId).toBe(ID_B);
  });
});
