import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerProfile } from "@/lib/types";
import WorkerProfileForm, { changedFields } from "./WorkerProfileForm";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    put: (...a: unknown[]) => put(...a),
    post: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));
vi.mock("@/components/LocationPicker", () => ({ default: () => null }));
vi.mock("@/components/CvUpload", () => ({
  default: () => null,
  NO_CV: { file: null, url: "", fileName: null },
}));

function perfil(extra: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: "p1",
    photo_url: null,
    birth_date: null,
    city: "Palermo, CABA",
    bio: "Bio vieja",
    latitude: -34.58,
    longitude: -58.43,
    skills: ["mozo"],
    years_experience: 2,
    languages: [],
    certifications: [],
    cv_file: null,
    cv_url: null,
    cv_filename: null,
    is_available: true,
    ...extra,
  } as WorkerProfile;
}

describe("WorkerProfileForm: sólo manda lo que la persona tocó", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it("conserva «Disponible» y la zona que otra pantalla cambió con el formulario abierto", async () => {
    const alAbrir = perfil();
    const enServidor = perfil({
      is_available: false,
      city: "Rosario, Santa Fe",
      latitude: -32.95,
      longitude: -60.64,
    });
    // 1ª lectura: al abrir. 2ª: la de `saveProfilePart`, ya con el cambio ajeno.
    get.mockResolvedValueOnce(alAbrir).mockResolvedValue(enServidor);
    put.mockImplementation(async (_p, body) => ({ ...enServidor, ...(body as object) }));

    render(<WorkerProfileForm />);
    const bio = await screen.findByLabelText("Sobre mí");
    fireEvent.change(bio, { target: { value: "Bio nueva" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const body = put.mock.calls[0][1];
    expect(body.bio).toBe("Bio nueva");
    expect(body.is_available).toBe(false);
    expect(body.city).toBe("Rosario, Santa Fe");
    expect(body.latitude).toBe(-32.95);
    expect(body.longitude).toBe(-60.64);
  });

  it("lo que la persona sí toca se manda aunque el servidor tenga otro valor", async () => {
    get.mockResolvedValueOnce(perfil()).mockResolvedValue(perfil({ is_available: false }));
    put.mockImplementation(async (_p, body) => body);

    render(<WorkerProfileForm />);
    fireEvent.click(await screen.findByRole("switch", { name: /Disponible para tomar turnos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    // Estaba «Disponible» al abrir y la persona lo apagó; en el servidor ya
    // estaba apagado: igual se manda lo que ella dejó en el formulario.
    expect(put.mock.calls[0][1].is_available).toBe(false);
  });
});

describe("changedFields", () => {
  const base = {
    city: "A",
    bio: null,
    skills: ["mozo"] as WorkerProfile["skills"],
    years_experience: 1,
    languages: [],
    certifications: [],
    latitude: 1,
    longitude: 2,
    is_available: true,
  };

  it("sin cambios no devuelve nada", () => {
    expect(changedFields({ ...base }, { ...base })).toEqual({});
  });

  it("la zona viaja completa si cambia cualquiera de sus partes", () => {
    expect(changedFields({ ...base, latitude: 9 }, base)).toEqual({
      city: "A",
      latitude: 9,
      longitude: 2,
    });
  });
});
