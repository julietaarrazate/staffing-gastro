import { describe, expect, it } from "vitest";
import {
  checkPhotoFile,
  checkUploadFile,
  cloudinaryErrorMessage,
} from "./upload-validation";

const f = (name: string, size = 1000, type = "") => new File([new ArrayBuffer(size)], name, { type });

describe("checkUploadFile", () => {
  it("CV: acepta pdf/doc/docx/jpg/png", () => {
    for (const n of ["a.pdf", "a.DOC", "a.docx", "a.jpg", "a.png"]) {
      expect(checkUploadFile(f(n), "cv")).toBeNull();
    }
  });
  it("tipo no permitido y peso dan mensajes distintos", () => {
    expect(checkUploadFile(f("a.exe"), "cv")).toMatch(/no está permitido.*PDF, Word, JPG o PNG/);
    expect(checkUploadFile(f("a.pdf", 11 * 1024 * 1024), "cv")).toMatch(/demasiado pesado.*11MB.*10MB/);
  });
  it("la constancia no acepta Word", () => {
    expect(checkUploadFile(f("a.docx"), "business")).toMatch(/no está permitido/);
  });
  it("sin extensión usa el tipo MIME", () => {
    expect(checkUploadFile(f("foto", 10, "image/png"), "image")).toBeNull();
  });
});

describe("checkPhotoFile", () => {
  it("un PDF no es foto", () => {
    expect(checkPhotoFile(f("a.pdf", 10, "application/pdf"))).toMatch(/no está permitido/);
    expect(checkPhotoFile(f("a.jpg", 10, "image/jpeg"))).toBeNull();
  });
});

describe("cloudinaryErrorMessage", () => {
  it("distingue peso, formato y desconocido", () => {
    expect(cloudinaryErrorMessage("File size too large. Got 20. Maximum is 10485760", "cv")).toMatch(/pesado/);
    expect(cloudinaryErrorMessage("Image format gif not allowed", "cv")).toMatch(/no está permitido/);
    expect(cloudinaryErrorMessage(undefined, "cv")).toMatch(/Probá de nuevo/);
  });
});
