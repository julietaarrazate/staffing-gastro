import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme";

/**
 * El tema cuando el `<script>` anti-flash no llegó a correr.
 *
 * Pasa en las pantallas que salen de un `notFound()` («Este turno ya no está
 * disponible», el link de un turno que no existe): Next manda un HTML vacío y
 * dibuja el layout en el navegador, y React no ejecuta los `<script>` que
 * inserta. `<html>` quedaba sin `data-theme` y la pantalla salía en claro
 * aunque la persona hubiera elegido oscuro (visto en las capturas del
 * 2026-11-12: la de oscuro era idéntica a la de claro).
 */

const html = document.documentElement;

beforeEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
});
afterEach(() => {
  html.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeProvider sin el script anti-flash", () => {
  it("aplica el oscuro que la persona había elegido", () => {
    localStorage.setItem("oido-theme", "dark");
    render(<ThemeProvider>hola</ThemeProvider>);
    expect(html.getAttribute("data-theme")).toBe("dark");
  });

  it("sin preferencia guardada queda en claro, y el atributo existe igual", () => {
    render(<ThemeProvider>hola</ThemeProvider>);
    expect(html.getAttribute("data-theme")).toBe("light");
  });

  it("si el script ya lo puso, no lo toca", () => {
    html.setAttribute("data-theme", "dark");
    render(<ThemeProvider>hola</ThemeProvider>);
    expect(html.getAttribute("data-theme")).toBe("dark");
  });
});
