import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageUpload from "./ImageUpload";

vi.mock("@/lib/cloudinary", () => ({ uploadImage: vi.fn() }));
vi.mock("@/components/ImageCropModal", () => ({ default: () => null }));

/**
 * Auditoría visual, fase L (regresión contra `docs/design/mockups/`).
 *
 * En el mockup aprobado el avatar muestra a la PERSONA. Lo que shipeaba era
 * otra cosa: sin foto, el ícono de cámara se dibujaba centrado a `inset-0`
 * ENCIMA de la inicial, y los dos glifos se pisaban — en el perfil del
 * trabajador el círculo ámbar mostraba una mancha blanca en vez de la "J" de
 * Julieta. Pasaba en las cuatro pantallas que usan este componente.
 *
 * Lo que se fija acá no es el diseño de la insignia sino la regla que lo
 * evita: **la inicial y el ícono nunca ocupan el mismo lugar.**
 */
describe("ImageUpload sin foto", () => {
  it("muestra la inicial de la persona, no una mancha", () => {
    render(<ImageUpload value={null} onChange={() => {}} fallbackLabel="Julieta A." />);
    expect(screen.getByRole("button", { name: "Subir foto de perfil" })).toHaveTextContent("J");
  });

  it("la cámara no se dibuja encima de la inicial", () => {
    const { container } = render(
      <ImageUpload value={null} onChange={() => {}} fallbackLabel="Julieta A." />
    );
    // El overlay a pantalla completa es el que pisaba: mientras no se esté
    // subiendo nada, no debe existir ninguno.
    expect(container.querySelectorAll(".absolute.inset-0")).toHaveLength(0);
  });

  it("igual se ve que la foto se puede tocar (insignia en la esquina)", () => {
    const { container } = render(
      <ImageUpload value={null} onChange={() => {}} fallbackLabel="Julieta A." />
    );
    // Sin esto el arreglo sería una regresión de usabilidad: en celular no hay
    // hover, así que si nada indica la acción, la foto parece no ser tocable.
    expect(container.querySelector(".absolute.bottom-0.right-0")).not.toBeNull();
  });

  it("con foto cargada mantiene la misma insignia, no otro patrón", () => {
    const { container } = render(
      <ImageUpload value="https://x/foto.jpg" onChange={() => {}} fallbackLabel="Julieta A." />
    );
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector(".absolute.bottom-0.right-0")).not.toBeNull();
  });
});
