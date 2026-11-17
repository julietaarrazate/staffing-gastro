import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ImageCropModal from "./ImageCropModal";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

describe("ImageCropModal con archivo ilegible", () => {
  it("si la imagen no carga avisa en español y deja elegir otra", () => {
    const onCancel = vi.fn();
    render(
      <ImageCropModal
        file={new File(["x"], "a.png", { type: "image/png" })}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.error(screen.getByAltText("Foto a encuadrar"));
    expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos abrir ese archivo como foto/);
    expect(screen.queryByText("Usar esta foto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Elegir otra" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
