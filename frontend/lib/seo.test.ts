import { describe, expect, it } from "vitest";
import { jobPostingDe, jsonLd } from "./seo";
import type { ShiftPublic } from "./types";

const TURNO: ShiftPublic = {
  id: "11111111-1111-4111-8111-111111111111",
  position: "mozo",
  start_at: "2026-12-05T20:00:00-03:00",
  end_at: "2026-12-06T01:00:00-03:00",
  city: "Palermo",
  pay_amount: "70000",
  currency: "ARS",
  company_name: "Bar Lavalle",
  tips: true,
  meal: false,
  dress_code: null,
  urgent: false,
  published_at: "2026-11-26T15:00:00Z",
};
const URL = "https://www.oido.com.ar/turno/11111111-1111-4111-8111-111111111111";

describe("jobPostingDe", () => {
  it("arma la oferta con lo que Google exige, y quien contrata es el comercio", () => {
    const oferta = jobPostingDe(TURNO, URL)!;
    expect(oferta["@type"]).toBe("JobPosting");
    expect(oferta.title).toBe("Mozo/a");
    expect(oferta.datePosted).toBe(TURNO.published_at);
    expect(oferta.validThrough).toBe(TURNO.start_at);
    expect(oferta.hiringOrganization).toEqual({ "@type": "Organization", name: "Bar Lavalle" });
    expect(JSON.stringify(oferta.hiringOrganization)).not.toContain("Oído");
    expect(oferta.jobLocation).toMatchObject({
      address: { addressLocality: "Palermo", addressCountry: "AR" },
    });
    // 70.000 por 5 horas.
    expect(oferta.baseSalary).toMatchObject({
      currency: "ARS",
      value: { value: 14000, unitText: "HOUR" },
    });
    expect(oferta.url).toBe(URL);
  });

  it("un turno reofrecido informa su valor por hora y vale hasta que termina", () => {
    const oferta = jobPostingDe({ ...TURNO, hourly_pay_amount: "15000" }, URL)!;
    expect(oferta.baseSalary).toMatchObject({ value: { value: 15000, unitText: "HOUR" } });
    expect(oferta.validThrough).toBe(TURNO.end_at);
  });

  it("sin nombre del comercio o sin fecha de publicación no emite nada", () => {
    expect(jobPostingDe({ ...TURNO, company_name: null }, URL)).toBeNull();
    expect(jobPostingDe({ ...TURNO, published_at: null }, URL)).toBeNull();
  });

  it("sin pago válido no inventa un sueldo", () => {
    expect(jobPostingDe({ ...TURNO, pay_amount: "" }, URL)).not.toHaveProperty("baseSalary");
  });
});

describe("jsonLd", () => {
  it("un nombre con </script> no puede cerrar el bloque", () => {
    const texto = jsonLd({ name: "Bar </script><script>alert(1)</script>" });
    expect(texto).not.toContain("</script>");
    expect(JSON.parse(texto).name).toBe("Bar </script><script>alert(1)</script>");
  });
});
