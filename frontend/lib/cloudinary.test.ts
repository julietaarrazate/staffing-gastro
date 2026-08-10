import { describe, expect, it } from "vitest";
import { cldAttachment } from "./cloudinary";

describe("cldAttachment", () => {
  it("inserta fl_attachment después de /upload/ en una URL de Cloudinary", () => {
    expect(cldAttachment("https://res.cloudinary.com/demo/image/upload/v123/cv.pdf")).toBe(
      "https://res.cloudinary.com/demo/image/upload/fl_attachment/v123/cv.pdf"
    );
  });

  it("funciona también con recursos raw", () => {
    expect(cldAttachment("https://res.cloudinary.com/demo/raw/upload/v123/cv.pdf")).toBe(
      "https://res.cloudinary.com/demo/raw/upload/fl_attachment/v123/cv.pdf"
    );
  });

  it("no duplica la transformación si ya está presente", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/fl_attachment/v123/cv.pdf";
    expect(cldAttachment(url)).toBe(url);
  });

  it("devuelve tal cual una URL que no es de Cloudinary (link pegado a mano)", () => {
    const url = "https://drive.google.com/file/d/abc123/view";
    expect(cldAttachment(url)).toBe(url);
  });
});
