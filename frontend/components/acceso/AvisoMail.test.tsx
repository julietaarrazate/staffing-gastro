import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AvisoMail from "./AvisoMail";

const post = vi.fn();
let limitado = false;
vi.mock("@/lib/api", () => ({
  api: { post: (...a: unknown[]) => post(...a) },
  isRateLimited: () => limitado,
  RATE_LIMITED_MESSAGE: "Demasiados intentos",
}));

describe("AvisoMail", () => {
  beforeEach(() => {
    post.mockReset();
    limitado = false;
  });

  it("no afirma que el mail se mandó: dice a qué dirección y qué revisar", () => {
    render(<AvisoMail email="ana@correo.com" />);
    const aviso = screen.getByTestId("aviso-mail");
    expect(aviso).toHaveTextContent("ana@correo.com");
    expect(aviso).toHaveTextContent("revisá la carpeta de spam y que la dirección esté bien escrita");
    expect(aviso).not.toHaveTextContent(/te mandamos/i);
  });

  it("«Pedir el mail de nuevo» usa el reenvío existente con la dirección del alta", async () => {
    post.mockResolvedValue({});
    render(<AvisoMail email="ana@correo.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir el mail de nuevo" }));
    await waitFor(() => expect(screen.getByTestId("aviso-mail-pedido")).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith("/auth/resend-verification", { email: "ana@correo.com" });
  });

  it("si el límite de intentos corta, lo dice y deja volver a probar", async () => {
    post.mockRejectedValue(new Error("429"));
    limitado = true;
    render(<AvisoMail email="ana@correo.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Pedir el mail de nuevo" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Demasiados intentos"));
    expect(screen.queryByTestId("aviso-mail-pedido")).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir el mail de nuevo" })).toBeEnabled();
  });
});
