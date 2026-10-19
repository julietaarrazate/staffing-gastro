import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import IconChip from "./IconChip";

/**
 * El tono tiene que salir de los pares tint/text que `globals.css` redefine
 * para oscuro. Un chip hecho de `bg-surface` "neutro" pierde el color sobre
 * una tarjeta oscura (lo que le pasó a la tile del medio del perfil en
 * septiembre), así que sólo `neutral` puede usarlo.
 */
describe("IconChip", () => {
  it.each(["cielo", "trust", "manteca", "secondary", "danger", "primary"] as const)(
    "el tono %s usa su par tint/text",
    (tone) => {
      const { container } = render(<IconChip tone={tone}>·</IconChip>);
      const chip = container.firstElementChild!;
      expect(chip.className).toContain(`bg-${tone}-tint`);
      expect(chip.className).toContain(`text-${tone}-text`);
    }
  );

  it("es decorativo para los lectores de pantalla", () => {
    const { container } = render(<IconChip tone="cielo">·</IconChip>);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
