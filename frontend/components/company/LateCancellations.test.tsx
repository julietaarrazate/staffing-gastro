import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LateCancellations from "./LateCancellations";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => apiGet(...a) } }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ late_cancellations: 2 });
});

describe("LateCancellations", () => {
  it("sin la cuenta, la lee del perfil del comercio", async () => {
    render(<LateCancellations />);
    expect(await screen.findByRole("region", { name: "Cancelaciones tardías" })).toHaveTextContent("2");
    expect(apiGet).toHaveBeenCalledWith("/companies/me/profile", "tok");
  });

  it("con la cuenta ya leída por quien lo dibuja, no vuelve a pedir el perfil", () => {
    render(<LateCancellations count={1} suave />);
    expect(screen.getByRole("region", { name: "Cancelaciones tardías" })).toHaveTextContent("Cancelación tardía");
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("en cero no dibuja nada, tampoco con la cuenta conocida", () => {
    render(<LateCancellations count={0} />);
    expect(screen.queryByRole("region", { name: "Cancelaciones tardías" })).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });
});
