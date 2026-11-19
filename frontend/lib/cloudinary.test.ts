import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  uploadBusinessDocument,
  uploadCv,
  uploadIdentityImage,
  uploadImage,
} from "./cloudinary";

const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

describe("subidas privadas (ADR-0021)", () => {
  const signed = {
    timestamp: "1",
    signature: "sig",
    api_key: "key",
    allowed_formats: "jpg",
    folder: "oido/identidad",
    public_id: "a".repeat(32),
    overwrite: "false",
    type: "authenticated",
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

  it("el DNI viaja con type=authenticated firmado y vuelve como referencia, no como URL", async () => {
    apiPost.mockResolvedValue(signed);
    const fetchMock = stubCloudinary({
      secure_url: "https://res.cloudinary.com/oido-test/image/authenticated/s--x--/v1/a.jpg",
      public_id: `oido/identidad/${"a".repeat(32)}`,
      resource_type: "image",
      format: "jpg",
      type: "authenticated",
    });

    const ref = await uploadIdentityImage(new File(["x"], "dni.jpg"), "tok");

    expect(apiPost).toHaveBeenCalledWith("/uploads/sign-image?kind=identity", undefined, "tok");
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("type")).toBe("authenticated");
    expect(ref).toEqual({
      public_id: `oido/identidad/${"a".repeat(32)}`,
      resource_type: "image",
      format: "jpg",
      type: "authenticated",
    });
  });

  it.each(["upload", "private"])("si Cloudinary lo dejó %s, no lo manda como protegido", async (tipo) => {
    apiPost.mockResolvedValue(signed);
    stubCloudinary({ secure_url: "https://x", public_id: "p", resource_type: "image", type: tipo });
    await expect(uploadBusinessDocument(new File(["x"], "c.pdf"), "tok")).rejects.toThrow(
      /privada/
    );
  });

  it("el CV también sube privado y vuelve como referencia (PRI-03)", async () => {
    apiPost.mockResolvedValue({ ...signed, folder: "oido/cv", allowed_formats: "pdf" });
    const fetchMock = stubCloudinary({
      secure_url: "https://res.cloudinary.com/oido-test/image/authenticated/s--y--/v1/cv.pdf",
      public_id: `oido/cv/${"b".repeat(64)}`,
      resource_type: "image",
      format: "pdf",
      type: "authenticated",
    });

    const ref = await uploadCv(new File(["x"], "cv.pdf"), "tok");

    expect(apiPost).toHaveBeenCalledWith("/uploads/sign-cv", undefined, "tok");
    expect((fetchMock.mock.calls[0][1].body as FormData).get("type")).toBe("authenticated");
    expect(ref).toEqual({
      public_id: `oido/cv/${"b".repeat(64)}`,
      resource_type: "image",
      format: "pdf",
      type: "authenticated",
    });
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
