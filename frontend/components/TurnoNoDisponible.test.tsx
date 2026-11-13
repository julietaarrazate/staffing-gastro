import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TurnoNoDisponible from "./TurnoNoDisponible";

/**
 * La pantalla de un turno que fue público y ya no está abierto (se tomó, se
 * canceló o pasó la hora). Antes ese link mostraba «404 | This page could not
 * be found.», en inglés y sin salida. `/turno/[id]` se arma en el servidor,
 * así que Playwright (API mockeada sólo en el navegador) no llega: acá se
 * prueba el componente, que es el que elige la salida según la sesión.
 */

const auth = vi.hoisted(() => ({
  value: { user: null as null | { role: string }, loading: false },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth.value }));

function link(name: string) {
  return screen.getByRole("link", { name });
}

beforeEach(() => {
  auth.value = { user: null, loading: false };
});

describe("TurnoNoDisponible", () => {
  it("lo dice en castellano y explica por qué", () => {
    render(<TurnoNoDisponible />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Este turno ya no está disponible" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ya se cubrió o el comercio lo dio de baja.")).toBeInTheDocument();
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument();
  });

  it("a un trabajador con sesión lo lleva a ver otros turnos en su Inicio", () => {
    auth.value = { user: { role: "worker" }, loading: false };
    render(<TurnoNoDisponible />);
    expect(link("Ver otros turnos")).toHaveAttribute("href", "/feed");
    // Si era un turno al que se había postulado, el resultado está en Mis turnos.
    expect(link("Ver mis turnos")).toHaveAttribute("href", "/my-shifts");
  });

  it("sin sesión invita a crear el perfil (o a entrar, si ya tiene cuenta)", () => {
    render(<TurnoNoDisponible />);
    expect(link("Crear mi perfil gratis")).toHaveAttribute("href", "/register?rol=trabajador");
    expect(link("Ya tengo cuenta")).toHaveAttribute("href", "/login");
    // El Inicio pide sesión: no se le ofrece un botón que rebota en el login.
    expect(screen.queryByRole("link", { name: "Ver otros turnos" })).not.toBeInTheDocument();
  });

  it("a un comercio lo devuelve a su panel", () => {
    auth.value = { user: { role: "employer" }, loading: false };
    render(<TurnoNoDisponible />);
    expect(link("Ir a mi panel")).toHaveAttribute("href", "/shifts");
    expect(screen.queryByRole("link", { name: "Ver otros turnos" })).not.toBeInTheDocument();
  });

  it("a la admin la devuelve a su panel", () => {
    auth.value = { user: { role: "admin" }, loading: false };
    render(<TurnoNoDisponible />);
    expect(link("Ir al panel")).toHaveAttribute("href", "/admin");
  });

  it("mientras no se sabe si hay sesión no muestra una salida equivocada", () => {
    auth.value = { user: null, loading: true };
    render(<TurnoNoDisponible />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
