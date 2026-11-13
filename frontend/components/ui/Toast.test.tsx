import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ message, tone }: { message: string; tone?: "success" | "error" | "info" }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      disparar
    </button>
  );
}

describe("ToastProvider", () => {
  it("el contenedor de toasts es una región viva anunciable por lector de pantalla", () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("un toast disparado aparece dentro de la región viva, no fuera de ella", async () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    screen.getByRole("button", { name: "disparar" }).click();

    const region = screen.getByRole("status");
    await waitFor(() => expect(region).toHaveTextContent("Turno publicado"));
  });

  it("ni el contenedor ni el cuerpo del aviso reciben toques: no tapan lo que hay debajo", async () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    screen.getByRole("button", { name: "disparar" }).click();

    const region = screen.getByRole("status");
    await waitFor(() => expect(region).toHaveTextContent("Turno publicado"));
    const cuerpo = screen.getByText("Turno publicado");

    expect(region.classList.contains("pointer-events-none")).toBe(true);
    expect(cuerpo.classList.contains("pointer-events-none")).toBe(true);
    expect(cuerpo.classList.contains("pointer-events-auto")).toBe(false);
    // Un botón de acción dentro del aviso sí recibe toques (hoy ningún aviso
    // lo tiene; la regla queda lista para cuando haya uno).
    expect(cuerpo.className).toContain("[&_button]:pointer-events-auto");
  });

  it("el aviso va arriba (bajo el encabezado) en todos los anchos", () => {
    render(
      <ToastProvider>
        <Trigger message="Turno publicado" />
      </ToastProvider>
    );
    const cls = screen.getByRole("status").className.split(/\s+/);
    // Una sola posición: arriba, debajo del encabezado y de la zona segura.
    // Nunca abajo, ni en celular ni en escritorio con la ventana baja (ahí
    // «Publicar turno» queda a media pantalla y el aviso lo pisaba).
    expect(cls).toContain("top-[calc(var(--chrome-top)+0.5rem)]");
    expect(cls.some((c) => c.includes("bottom-"))).toBe(false);
    expect(cls.some((c) => c.startsWith("md:top-") || c.startsWith("md:bottom-"))).toBe(false);
    // Sigue por encima del encabezado (z-40) para no quedar tapado.
    expect(cls).toContain("z-[60]");
  });

  it("la entrada no depende de la dirección: sólo opacidad y escala (arriba no puede subir desde abajo)", () => {
    const fuente = readFileSync(resolve(__dirname, "Toast.tsx"), "utf8");
    const initial = fuente.match(/initial=\{([^\n]*)\}/)?.[1] ?? "";
    expect(initial).toContain("opacity: 0");
    expect(initial).not.toMatch(/\by:/);
  });
});
