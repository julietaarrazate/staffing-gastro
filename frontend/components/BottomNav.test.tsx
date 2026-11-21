import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";

let auth: Record<string, unknown>;
let ruta: string;
let sinLeer: number;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("@/lib/avisos", () => ({ useAvisos: () => ({ unreadCount: sinLeer }) }));
vi.mock("next/navigation", () => ({ usePathname: () => ruta }));

const sesion = (role: string, extra: object = {}) => ({ user: { role }, loading: false, twoFactorSetupPending: false, ...extra });

beforeEach(() => {
  ruta = "/admin/seguridad";
  sinLeer = 0;
});

describe("BottomNav", () => {
  it("al admin con el alta de 2FA pendiente no le muestra la barra (U133)", () => {
    auth = sesion("admin", { twoFactorSetupPending: true });
    render(<BottomNav />);
    expect(screen.queryByRole("navigation", { name: "Secciones" })).not.toBeInTheDocument();
  });

  it("con el alta resuelta la barra sigue", () => {
    auth = sesion("admin");
    render(<BottomNav />);
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
  });
});

describe("BottomNav: los avisos sin leer, en la pestaña por la que se llega a ellos", () => {
  it("fuera del Inicio, la pestaña Inicio lleva la cuenta y la dice", () => {
    auth = sesion("worker");
    ruta = "/buscar";
    sinLeer = 3;
    render(<BottomNav />);
    const inicio = screen.getByRole("link", { name: "Inicio, 3 avisos sin leer" });
    expect(inicio).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
  });

  it("uno solo va en singular, y más de nueve como «9+»", () => {
    auth = sesion("employer");
    ruta = "/chats";
    sinLeer = 1;
    const { unmount } = render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Panel, 1 aviso sin leer" })).toBeInTheDocument();
    unmount();
    sinLeer = 12;
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Panel, 12 avisos sin leer" })).toHaveTextContent("9+");
  });

  it("en el Inicio no se repite: ahí la cuenta está en la campanita", () => {
    auth = sesion("worker");
    ruta = "/feed";
    sinLeer = 3;
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveTextContent("3");
  });

  it("en una pantalla de adentro del Panel (publicar, candidatos) no hay campanita: la pestaña lleva la cuenta aunque esté activa", () => {
    auth = sesion("employer");
    ruta = "/shifts/s1/candidates";
    sinLeer = 2;
    render(<BottomNav />);
    const panel = screen.getByRole("link", { name: "Panel, 2 avisos sin leer" });
    expect(panel).toHaveAttribute("aria-current", "page");
  });

  it("sin avisos sin leer no hay cuenta", () => {
    auth = sesion("worker");
    ruta = "/buscar";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
  });

  it("el admin conserva la campanita arriba: su pestaña no lleva cuenta", () => {
    auth = sesion("admin");
    ruta = "/map";
    sinLeer = 4;
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Panel" })).not.toHaveTextContent("4");
  });
});

describe("BottomNav: cinco pestañas para quien trabaja", () => {
  it("Inicio, Buscar, Turnos, Chats y Perfil: sin «Mapa» ni «Matches»", () => {
    auth = sesion("worker");
    ruta = "/feed";
    render(<BottomNav />);
    const nombres = screen.getAllByRole("link").map((a) => a.textContent);
    expect(nombres).toEqual(["Inicio", "Buscar", "Turnos", "Chats", "Perfil"]);
  });

  it("en el Mapa la pestaña activa es Buscar: son la misma tarea", () => {
    auth = sesion("worker");
    ruta = "/map";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Turnos" })).not.toHaveAttribute("aria-current");
  });

  it("el admin conserva su pestaña «Mapa»", () => {
    auth = sesion("admin");
    ruta = "/map";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Mapa" })).toHaveAttribute("aria-current", "page");
  });
});

describe("BottomNav: el «+» de «Publicar turno»", () => {
  it("el comercio lo tiene al lado de la barra, fuera de las pestañas", () => {
    auth = sesion("employer");
    ruta = "/shifts";
    render(<BottomNav />);
    const mas = screen.getByRole("link", { name: "Publicar turno" });
    expect(mas).toHaveAttribute("href", "/shifts/new");
    expect(screen.getByRole("navigation", { name: "Secciones" })).not.toContainElement(mas);
  });

  it.each(["/shifts/new", "/shifts/new-event"])("publicando (%s) no va", (donde) => {
    auth = sesion("employer");
    ruta = donde;
    render(<BottomNav />);
    expect(screen.queryByRole("link", { name: "Publicar turno" })).not.toBeInTheDocument();
  });

  it.each(["worker", "admin"])("%s no lo tiene", (role) => {
    auth = sesion(role);
    ruta = "/map";
    render(<BottomNav />);
    expect(screen.queryByRole("link", { name: "Publicar turno" })).not.toBeInTheDocument();
  });
});
