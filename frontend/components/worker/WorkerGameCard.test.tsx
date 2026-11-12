import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkerProfile } from "@/lib/types";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ token: "tok", user: { full_name: "Vera Datos" } }),
}));
// La subida real (recorte + Cloudinary) no es lo que se prueba: un botón
// entrega la URL ya subida, igual que hace `ImageUpload` al terminar.
vi.mock("@/components/ImageUpload", () => ({
  default: ({ onChange }: { onChange: (url: string) => void }) => (
    <button type="button" onClick={() => onChange("https://cdn.example/foto-nueva.jpg")}>
      Subir foto
    </button>
  ),
}));
vi.mock("@/components/EditableName", () => ({ default: () => null }));

import WorkerGameCard from "./WorkerGameCard";

function perfil(extra: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: "p1",
    user_id: "u1",
    photo_url: null,
    birth_date: null,
    age: null,
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
    rating: 0,
    events_completed: 0,
    punctuality_rate: 0,
    cancellations: 0,
    no_shows: 0,
    badges: [],
    level: "bronce",
    identidad_verificada: false,
    ...extra,
  } as WorkerProfile;
}

describe("WorkerGameCard: cambiar la foto", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it("con el perfil viejo en pantalla, el PUT lleva lo más nuevo del servidor y la foto nueva", async () => {
    const vieja = perfil({ bio: "Descripción vieja" });
    const nueva = perfil({ bio: "Descripción nueva", skills: ["mozo", "barista"] as never });
    // 1ª lectura: al montar (copia que queda en pantalla). 2ª: justo antes de guardar.
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings") throw new Error("sin ganancias");
      return get.mock.calls.filter((c) => c[0] === "/workers/me/profile").length === 1 ? vieja : nueva;
    });
    put.mockImplementation(async (_p, body) => ({ ...nueva, ...(body as object) }));

    render(<WorkerGameCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Subir foto" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [path, body] = put.mock.calls[0];
    expect(path).toBe("/workers/me/profile");
    expect(body.photo_url).toBe("https://cdn.example/foto-nueva.jpg");
    expect(body.bio).toBe("Descripción nueva");
    expect(body.skills).toEqual(["mozo", "barista"]);
    expect(body.cv_filename).toBe("CV-Vera.pdf");
  });

  it("si no se puede guardar la foto, avisa", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings") throw new Error("sin ganancias");
      return perfil();
    });
    put.mockRejectedValue(new Error("sin conexión"));

    render(<WorkerGameCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Subir foto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar tu foto");
  });
});
