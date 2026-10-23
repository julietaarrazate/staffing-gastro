import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cldAttachment,
  uploadBusinessDocument,
  uploadIdentityImage,
  uploadImage,
} from "./cloudinary";

const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

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

describe("subidas privadas (ADR-0021)", () => {
  const signed = {
    timestamp: "1",
    signature: "sig",
    api_key: "key",
    allowed_formats: "jpg",
    folder: "oido/identidad",
    public_id: "a".repeat(32),
    overwrite: "false",
    type: "private",
  };

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "oido-test");
    apiPost.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubCloudinary(response: Record<string, unknown>) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("el DNI viaja con type=private firmado y vuelve como referencia, no como URL", async () => {
    apiPost.mockResolvedValue(signed);
    const fetchMock = stubCloudinary({
      secure_url: "https://res.cloudinary.com/oido-test/image/private/s--x--/v1/a.jpg",
      public_id: `oido/identidad/${"a".repeat(32)}`,
      resource_type: "image",
      format: "jpg",
      type: "private",
    });

    const ref = await uploadIdentityImage(new File(["x"], "dni.jpg"), "tok");

    expect(apiPost).toHaveBeenCalledWith("/uploads/sign-image?kind=identity", undefined, "tok");
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("type")).toBe("private");
    expect(ref).toEqual({
      public_id: `oido/identidad/${"a".repeat(32)}`,
      resource_type: "image",
      format: "jpg",
      type: "private",
    });
  });

  it("si Cloudinary lo dejó público, no lo manda como privado", async () => {
    apiPost.mockResolvedValue(signed);
    stubCloudinary({ secure_url: "https://x", public_id: "p", resource_type: "image", type: "upload" });
    await expect(uploadBusinessDocument(new File(["x"], "c.pdf"), "tok")).rejects.toThrow(
      /privada/
    );
  });

  it("la foto de perfil no manda type (sigue pública)", async () => {
    apiPost.mockResolvedValue({ ...signed, folder: "oido/perfiles", type: null });
    const fetchMock = stubCloudinary({
      secure_url: "https://res.cloudinary.com/oido-test/image/upload/v1/p.jpg",
      public_id: "p",
      resource_type: "image",
      type: "upload",
    });
    const url = await uploadImage(new File(["x"], "p.jpg"), "tok", "profile");
    expect(url).toBe("https://res.cloudinary.com/oido-test/image/upload/v1/p.jpg");
    expect((fetchMock.mock.calls[0][1].body as FormData).has("type")).toBe(false);
  });
});
