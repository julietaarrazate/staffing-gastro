import { act, fireEvent, render, screen } from "@testing-library/react";
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
    // U101: sin fecha de nacimiento los botones siguen deshabilitados.
    expect(screen.getByRole("button", { name: "Busco trabajo" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1995-05-20" } });
    await user.click(screen.getByRole("button", { name: "Busco trabajo" }));

    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "worker", "1995-05-20");
    // El rol viaja con `onDone` para el plan elegido en la landing (/register).
    expect(onDone).toHaveBeenCalledWith(true, "worker", undefined);
  });

  it("a un menor de 18 no le deja crear la cuenta (U101)", async () => {
    const user = userEvent.setup();
    await renderAtRoleStep();
    await user.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "2012-03-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Oído es sólo para mayores de 18 años.");
    expect(screen.getByRole("button", { name: "Busco trabajo" })).toBeDisabled();
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
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
    render(
      <GoogleAuthButton onDone={onDone} rolElegido="employer" terminosAceptados nacimientoElegido="1995-05-20" />
    );
    await act(async () => {
      googleCallback?.({ credential: "id-token" });
    });
    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "employer", "1995-05-20");
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
    rerender({ rolElegido: "worker", terminosAceptados: true, nacimientoElegido: "1995-05-20" });
    await user.click(screen.getByRole("button", { name: "Crear cuenta con Google" }));
    expect(loginWithGoogle).toHaveBeenLastCalledWith("id-token", "worker", "1995-05-20");
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
    <GoogleAuthButton onDone={onDone} rolElegido="worker" terminosAceptados={false} nacimientoElegido="1995-05-20" />
  );
  await act(async () => {
    googleCallback?.({ credential: "id-token" });
  });
  return {
    rerender: (p: { rolElegido: "worker" | "employer"; terminosAceptados: boolean; nacimientoElegido: string }) =>
      view.rerender(<GoogleAuthButton onDone={onDone} {...p} />),
  };
}
