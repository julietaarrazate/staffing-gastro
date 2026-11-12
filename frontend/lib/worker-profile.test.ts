import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerProfile } from "@/lib/types";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));

import { saveProfilePart } from "./worker-profile";

function perfil(extra: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    photo_url: null,
    birth_date: null,
    city: "Palermo, CABA",
    bio: "Descripción vieja",
    latitude: -34.58,
    longitude: -58.43,
    skills: ["mozo"],
    years_experience: 2,
    languages: [],
    certifications: [],
    cv_url: "https://cdn.example/cv.pdf",
    cv_filename: "CV-Vera.pdf",
    is_available: true,
    ...extra,
  } as WorkerProfile;
}

describe("saveProfilePart", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it("lee el perfil del servidor y manda todo con el cambio encima", async () => {
    const enServidor = perfil({ bio: "Descripción nueva", skills: ["mozo", "barista"] as never });
    get.mockResolvedValue(enServidor);
    put.mockImplementation(async (_p, body) => ({ ...enServidor, ...(body as object) }));

    const saved = await saveProfilePart("tok", { photo_url: "https://cdn.example/foto.jpg" });

    expect(get).toHaveBeenCalledWith("/workers/me/profile", "tok");
    const [path, body, token] = put.mock.calls[0];
    expect(path).toBe("/workers/me/profile");
    expect(token).toBe("tok");
    expect(body).toMatchObject({
      photo_url: "https://cdn.example/foto.jpg",
      bio: "Descripción nueva",
      skills: ["mozo", "barista"],
      cv_filename: "CV-Vera.pdf",
      cv_url: "https://cdn.example/cv.pdf",
      is_available: true,
    });
    expect(saved.photo_url).toBe("https://cdn.example/foto.jpg");
  });

  it("manda lo que leyó del servidor con el cambio encima", async () => {
    const enServidor = perfil({ bio: "Descripción nueva", is_available: true });
    get.mockResolvedValue(enServidor);
    put.mockResolvedValue(enServidor);

    await saveProfilePart("tok", { is_available: false });

    const body = put.mock.calls[0][1];
    expect(body.is_available).toBe(false);
    expect(body.bio).toBe("Descripción nueva");
    expect(body.cv_filename).toBe("CV-Vera.pdf");
  });

  it("si no se puede leer el perfil, no escribe nada", async () => {
    get.mockRejectedValue(new Error("sin conexión"));
    await expect(saveProfilePart("tok", { is_available: false })).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});
