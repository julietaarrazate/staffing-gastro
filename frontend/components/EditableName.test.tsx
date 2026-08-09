import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditableName from "./EditableName";

const updateFullName = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { full_name: "Juan Mozo" },
    updateFullName,
  }),
}));

vi.mock("@/components/ui", () => ({
  useToast: () => toast,
}));

beforeEach(() => {
  updateFullName.mockReset();
  toast.mockReset();
});

describe("EditableName", () => {
  it("muestra el nombre actual y no el form de edición", () => {
    render(<EditableName />);
    expect(screen.getByText("Juan Mozo")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("tocar 'Editar nombre' abre un input precargado con el nombre actual", async () => {
    const user = userEvent.setup();
    render(<EditableName />);

    await user.click(screen.getByRole("button", { name: "Editar nombre" }));

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Juan Mozo");
  });

  it("guardar un nombre nuevo llama a updateFullName recortado y vuelve a la vista", async () => {
    updateFullName.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EditableName />);

    await user.click(screen.getByRole("button", { name: "Editar nombre" }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "  Juan Carlos Mozo  ");
    await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

    await waitFor(() => expect(updateFullName).toHaveBeenCalledWith("Juan Carlos Mozo"));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("guardar sin cambios (o vacío) no llama al backend, sólo cierra la edición", async () => {
    const user = userEvent.setup();
    render(<EditableName />);

    await user.click(screen.getByRole("button", { name: "Editar nombre" }));
    // El valor ya es "Juan Mozo" (sin cambios) — enviar tal cual.
    await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(updateFullName).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("cancelar descarta el cambio sin llamar a updateFullName", async () => {
    const user = userEvent.setup();
    render(<EditableName />);

    await user.click(screen.getByRole("button", { name: "Editar nombre" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Nombre que no se guarda");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(updateFullName).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // Sigue mostrando el nombre original, no el que se tipeó y canceló.
    expect(screen.getByText("Juan Mozo")).toBeInTheDocument();
  });

  it("si updateFullName falla, avisa por toast y se queda en modo edición (no pierde lo tipeado)", async () => {
    updateFullName.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<EditableName />);

    await user.click(screen.getByRole("button", { name: "Editar nombre" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Nombre Nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("No se pudo actualizar el nombre", "error")
    );
    expect(screen.getByRole("textbox")).toHaveValue("Nombre Nuevo");
  });
});
