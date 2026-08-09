import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TextField from "./TextField";

describe("TextField", () => {
  it("sin error: no hay ningún mensaje ni aria-invalid", () => {
    render(<TextField label="Nombre" value="" onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("con error: lo anuncia con role=alert y lo conecta al input vía aria-describedby", () => {
    render(<TextField label="Nombre" value="" onChange={vi.fn()} error="Campo requerido" />);
    const input = screen.getByRole("textbox");
    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Campo requerido");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", alert.id);
  });

  it("pasa maxLength al input nativo", () => {
    render(<TextField label="Nombre" value="" onChange={vi.fn()} maxLength={200} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "200");
  });
});
