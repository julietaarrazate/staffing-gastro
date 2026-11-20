import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkerProfile } from "@/lib/types";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: { get: (...a: unknown[]) => get(...a), getFresco: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
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

// Cada una pide lo suyo al backend y tiene sus propios tests.
vi.mock("@/components/worker/AvailableNowToggle", () => ({ default: () => null }));
vi.mock("@/components/worker/IdentityVerificationCard", () => ({ default: () => null }));
vi.mock("@/components/ReceivedReviews", () => ({ default: () => null }));

import PerfilTrabajador from "./PerfilTrabajador";

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

describe("PerfilTrabajador: cambiar la foto", () => {
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

    render(<PerfilTrabajador />);
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

    render(<PerfilTrabajador />);
    await userEvent.click(await screen.findByRole("button", { name: "Subir foto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar tu foto");
  });
});

describe("PerfilTrabajador: cancelaciones y ausencias en el perfil propio", () => {
  beforeEach(() => get.mockReset());

  function conPerfil(p: WorkerProfile) {
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings") throw new Error("sin ganancias");
      return p;
    });
  }

  it("sin turnos hechos pero con 1 ausencia y 1 cancelación, las muestra", async () => {
    conPerfil(perfil({ events_completed: 0, no_shows: 1, cancellations: 1 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByText("Ausencias")).toBeInTheDocument();
    expect(screen.getByText("Cancelaciones")).toBeInTheDocument();
    expect(screen.getByText("Tu reputación arranca con tu primer turno.")).toBeInTheDocument();
    // Sin historia no aparece el resto de los datos.
    expect(screen.queryByText(/turnos? hechos?/)).not.toBeInTheDocument();
    expect(screen.queryByText("Años de experiencia")).not.toBeInTheDocument();
  });

  it("sin turnos y sin faltas, sigue el mensaje de siempre y nada más", async () => {
    conPerfil(perfil());
    render(<PerfilTrabajador />);
    expect(await screen.findByText("Tu reputación arranca con tu primer turno.")).toBeInTheDocument();
    expect(screen.queryByText("Ausencias")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelaciones")).not.toBeInTheDocument();
  });

  it("con turnos hechos y una ausencia, la suma a los demás datos", async () => {
    conPerfil(perfil({ events_completed: 3, no_shows: 1 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByText("Ausencias")).toBeInTheDocument();
    expect(screen.getByText("turnos hechos")).toBeInTheDocument();
  });

  it("con turnos hechos y sin ausencias, queda como antes (sin «Ausencias»)", async () => {
    conPerfil(perfil({ events_completed: 3 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByText("Cancelaciones")).toBeInTheDocument();
    expect(screen.queryByText("Ausencias")).not.toBeInTheDocument();
  });

  it("con al menos una ausencia o cancelación, ofrece escribir a Soporte en un toque", async () => {
    conPerfil(perfil({ no_shows: 1 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByText(/¿Alguna no corresponde\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/support");
  });

  it("con turnos hechos y una cancelación, también", async () => {
    conPerfil(perfil({ events_completed: 3, cancellations: 1 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/support");
  });

  it("sin ausencias ni cancelaciones no aparece", async () => {
    conPerfil(perfil({ events_completed: 3 }));
    render(<PerfilTrabajador />);
    expect(await screen.findByText("turnos hechos")).toBeInTheDocument();
    expect(screen.queryByText(/¿Alguna no corresponde\?/)).not.toBeInTheDocument();
  });
});

describe("PerfilTrabajador: la reputación en grande", () => {
  beforeEach(() => get.mockReset());

  it("con nota, el número grande es la nota y al lado van los turnos y la puntualidad", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings") throw new Error("sin ganancias");
      return perfil({ events_completed: 32, rating: 4.86, punctuality_rate: 0.97 });
    });
    render(<PerfilTrabajador />);
    expect(await screen.findByText("4,9")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4,9 de 5 estrellas" })).toBeInTheDocument();
    expect(screen.getByText(/32 turnos hechos · puntualidad 97%/)).toBeInTheDocument();
  });

  it("sin nota todavía, el número grande son los turnos hechos (no un 0,0 ni estrellas vacías)", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings") throw new Error("sin ganancias");
      return perfil({ events_completed: 1, rating: 0, punctuality_rate: 1 });
    });
    render(<PerfilTrabajador />);
    expect(await screen.findByText("turno hecho")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /estrellas/ })).not.toBeInTheDocument();
    expect(screen.getByText("puntualidad 100%")).toBeInTheDocument();
  });

  it("los puestos y la zona van debajo del nombre, y las ganancias en su fila", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/workers/me/earnings")
        return { total_earned: "480000", this_month_earned: "120000", shifts_completed: 3 };
      return perfil({ events_completed: 3, skills: ["mozo", "bartender"] as never });
    });
    render(<PerfilTrabajador />);
    expect(await screen.findByText(/y .+ · Palermo, CABA/)).toBeInTheDocument();
    expect(await screen.findByText("Ganado este mes")).toBeInTheDocument();
    expect(screen.getByText(/en total/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/profile/settings");
  });
});
