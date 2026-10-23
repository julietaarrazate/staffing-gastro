import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentityReviewQueue from "./IdentityReviewQueue";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));

const SIGNED =
  "https://api.cloudinary.com/v1_1/oido/image/download?public_id=oido%2Fidentidad%2Fa&expires_at=1";

const CLAIM = {
  claim_id: "c-1",
  user_id: "u-1",
  claim_type: "documento_verificado",
  full_name: "Ana Pérez",
  company_name: null,
  submitted_at: "2026-10-23T12:00:00Z",
  evidences: [
    { evidence_id: "ev-dni", evidence_type: "dni_frente", available: true },
    { evidence_id: "ev-selfie", evidence_type: "selfie", available: false },
  ],
};

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((path: string) => {
    if (path === "/identity/claims/pending") return Promise.resolve([CLAIM]);
    if (path === "/identity/evidences/ev-dni/link")
      return Promise.resolve({
        url: SIGNED,
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    return Promise.reject(new Error(`inesperado: ${path}`));
  });
});

describe("IdentityReviewQueue (ADR-0021)", () => {
  it("muestra cada evidencia con un link que vence, pedido por evidencia", async () => {
    render(<IdentityReviewQueue />);

    const img = await screen.findByRole("img", { name: "DNI (frente)" });
    expect(img).toHaveAttribute("src", SIGNED);
    expect(apiGet).toHaveBeenCalledWith("/identity/evidences/ev-dni/link", "tok");
  });

  it("una evidencia sin archivo no pide link y lo dice", async () => {
    render(<IdentityReviewQueue />);

    expect(await screen.findByText("Sin archivo")).toBeInTheDocument();
    await waitFor(() =>
      expect(apiGet).not.toHaveBeenCalledWith("/identity/evidences/ev-selfie/link", "tok")
    );
  });

  it("si el link no llega, ofrece reintentar", async () => {
    apiGet.mockImplementation((path: string) =>
      path === "/identity/claims/pending"
        ? Promise.resolve([CLAIM])
        : Promise.reject(new Error("503"))
    );
    render(<IdentityReviewQueue />);

    expect(await screen.findByText("No se pudo abrir")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
