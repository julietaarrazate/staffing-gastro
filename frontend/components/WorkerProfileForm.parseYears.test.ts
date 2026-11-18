import { describe, expect, it } from "vitest";
import { parseYears } from "./WorkerProfileForm";

describe("parseYears", () => {
  it("vacío o no numérico es 0", () => {
    expect(parseYears("")).toBe(0);
    expect(parseYears("abc")).toBe(0);
  });
  it("respeta los números y los ceros a la izquierda", () => {
    expect(parseYears("7")).toBe(7);
    expect(parseYears("07")).toBe(7);
  });
  it("no pasa del tope de 80 ni baja de 0", () => {
    expect(parseYears("500")).toBe(80);
    expect(parseYears("-3")).toBe(0);
  });
});
