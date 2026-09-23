import { describe, expect, it } from "vitest";
import { shiftHeroPhoto } from "./company-photo";

describe("shiftHeroPhoto", () => {
  it("prefiere la foto del local", () => {
    expect(shiftHeroPhoto({ company_cover_url: "salon.jpg", company_logo_url: "logo.png" })).toBe("salon.jpg");
  });
  it("sin foto del local, usa el logo (como antes)", () => {
    expect(shiftHeroPhoto({ company_cover_url: null, company_logo_url: "logo.png" })).toBe("logo.png");
    expect(shiftHeroPhoto({ company_logo_url: "logo.png" })).toBe("logo.png");
  });
  it("sin nada, null: la tarjeta cae al tono del rubro", () => {
    expect(shiftHeroPhoto({ company_cover_url: "", company_logo_url: null })).toBeNull();
  });
});
