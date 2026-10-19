import { describe, expect, it } from "vitest";
import { detectarPlataforma } from "./instalar";

describe("detectarPlataforma", () => {
  it("reconoce un iPhone", () => {
    expect(
      detectarPlataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", true)
    ).toBe("iphone");
  });
  it("reconoce un iPad, que se presenta como Mac pero es táctil", () => {
    expect(detectarPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", true)).toBe("iphone");
  });
  it("una Mac sin pantalla táctil es compu", () => {
    expect(detectarPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", false)).toBe("compu");
  });
  it("reconoce Android", () => {
    expect(detectarPlataforma("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0 Mobile Safari/537.36", true)).toBe("android");
  });
});
