import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorGeneral from "./error";

describe("app/error.tsx", () => {
  it("dice qué pasó, ofrece «Probar de nuevo» (reset) y un link a inicio, sin mostrar el error técnico", async () => {
    const reset = vi.fn();
    render(<ErrorGeneral error={new Error("boom interno")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeInTheDocument();
    expect(screen.queryByText(/boom interno/)).toBeNull();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("button", { name: "Probar de nuevo" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
