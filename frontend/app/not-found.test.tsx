import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

/**
 * La pantalla de «no encontrada» de toda la app. Sin `app/not-found.tsx`,
 * cualquier dirección que no existe (y el link de un turno inexistente)
 * mostraba la de Next: «404 | This page could not be found.», en inglés y
 * sin salida.
 */
describe("app/not-found", () => {
  it("lo dice en castellano y ofrece volver al inicio", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "No encontramos esa página" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument();
  });

  it("la pestaña también lo dice en castellano", () => {
    expect(metadata.title).toBe("Página no encontrada");
  });
});
