import { describe, expect, it } from "vitest";
import { normalizeUserLink, safeHttpsUrl } from "./safe-url";

describe("safeHttpsUrl", () => {
  it("deja pasar https", () => {
    const url = "https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf";
    expect(safeHttpsUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "http://ejemplo.com/cv.pdf",
    "//ejemplo.com/cv.pdf",
    "cv.pdf",
    "",
    null,
    undefined,
  ])("descarta %s", (value) => {
    expect(safeHttpsUrl(value)).toBeNull();
  });
});

describe("normalizeUserLink", () => {
  it.each([
    ["linkedin.com/in/julieta", "https://linkedin.com/in/julieta"],
    ["  http://drive.google.com/x ", "https://drive.google.com/x"],
    ["//ejemplo.com/cv.pdf", "https://ejemplo.com/cv.pdf"],
    ["https://ejemplo.com/cv.pdf", "https://ejemplo.com/cv.pdf"],
    ["javascript:alert(1)", "javascript:alert(1)"],
    ["   ", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUserLink(input)).toBe(expected);
  });
});
