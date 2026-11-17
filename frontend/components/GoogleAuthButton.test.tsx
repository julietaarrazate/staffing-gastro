import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Crear una cuenta con Google pide aceptar términos y privacidad, igual que
 * el formulario de email. Hasta el 2026-09-26 el botón de Google creaba la
 * cuenta sin pasar por el checkbox, que sólo trababa el formulario.
 */

const loginWithGoogle = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ loginWithGoogle }) }));
vi.mock("@/lib/theme", () => ({ useResolvedTheme: () => "light" }));
vi.mock("next/script", () => ({ default: () => null }));

let googleCallback: ((r: { credential: string }) => void) | null = null;

beforeEach(() => {
  loginWithGoogle.mockReset();
  googleCallback = null;
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          googleCallback = config.callback;
        },
        renderButton: () => {},
      },
    },
  };
});

async function renderAtRoleStep(onDone = vi.fn(), props: Record<string, unknown> = {}) {
  vi.resetModules();
  const { default: GoogleAuthButton } = await import("./GoogleAuthButton");
  loginWithGoogle.mockResolvedValueOnce({
    requiresRole: true,
    email: "nueva@gmail.com",
    fullName: "Nueva Persona",
  });
  render(<GoogleAuthButton onDone={onDone} {...props} />);
  await act(async () => {
    googleCallback?.({ credential: "id-token" });
  });
  return onDone;
}

describe("GoogleAuthButton: cuenta nueva", () => {
  it("no deja elegir el rol sin aceptar términos y privacidad", async () => {
    await renderAtRoleStep();
    expect(screen.getByRole("button", { name: "Busco trabajo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Busco personal" })).toBeDisabled();
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("con los términos aceptados crea la cuenta con el rol elegido", async () => {
    const user = userEvent.setup();
    const onDone = await renderAtRoleStep();
    loginWithGoogle.mockResolvedValueOnce({ requiresRole: false });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Busco trabajo" }));

    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "worker");
    // El rol viaja con `onDone` para el plan elegido en la landing (/register).
    expect(onDone).toHaveBeenCalledWith(true, "worker", undefined);
  });
});

describe("GoogleAuthButton: botón de Google", () => {
  it("no queda pegado arriba de la pregunta del rol", async () => {
    window.google!.accounts.id.renderButton = (el: HTMLElement) => {
      el.innerHTML = '<span data-testid="gis">Continuar con Google</span>';
    };
    await renderAtRoleStep();
    expect(screen.queryByTestId("gis")).toBeNull();
  });
});

describe("GoogleAuthButton: desde /register con el formulario ya completo (U043)", () => {
  it("crea la cuenta con el rol y los términos del formulario, sin volver a preguntar", async () => {
    const onDone = vi.fn();
    // 1ª llamada: pide rol (cuenta nueva); 2ª: la crea.
    loginWithGoogle.mockResolvedValueOnce({
      requiresRole: true,
      email: "nueva@gmail.com",
      fullName: "Nueva Persona",
    });
    loginWithGoogle.mockResolvedValueOnce({ requiresRole: false });
    vi.resetModules();
    const { default: GoogleAuthButton } = await import("./GoogleAuthButton");
    render(<GoogleAuthButton onDone={onDone} rolElegido="employer" terminosAceptados />);
    await act(async () => {
      googleCallback?.({ credential: "id-token" });
    });
    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "employer");
    expect(onDone).toHaveBeenCalledWith(true, "employer", undefined);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Busco trabajo" })).toBeNull();
  });

  it("sin términos aceptados no crea la cuenta y espera la casilla del formulario", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const { rerender } = await renderAtRoleStepRerender(onDone);
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const boton = screen.getByRole("button", { name: "Crear cuenta con Google" });
    expect(boton).toBeDisabled();

    loginWithGoogle.mockResolvedValueOnce({ requiresRole: false });
    rerender({ rolElegido: "worker", terminosAceptados: true });
    await user.click(screen.getByRole("button", { name: "Crear cuenta con Google" }));
    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "worker");
    expect(onDone).toHaveBeenCalledWith(true, "worker", undefined);
  });
});

async function renderAtRoleStepRerender(onDone: () => void) {
  vi.resetModules();
  const { default: GoogleAuthButton } = await import("./GoogleAuthButton");
  loginWithGoogle.mockResolvedValueOnce({
    requiresRole: true,
    email: "nueva@gmail.com",
    fullName: "Nueva Persona",
  });
  const view = render(
    <GoogleAuthButton onDone={onDone} rolElegido="worker" terminosAceptados={false} />
  );
  await act(async () => {
    googleCallback?.({ credential: "id-token" });
  });
  return {
    rerender: (p: { rolElegido: "worker" | "employer"; terminosAceptados: boolean }) =>
      view.rerender(<GoogleAuthButton onDone={onDone} {...p} />),
  };
}
