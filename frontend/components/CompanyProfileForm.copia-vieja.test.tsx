import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyProfile } from "@/lib/types";
import CompanyProfileForm, { changedCompanyFields } from "./CompanyProfileForm";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    put: (...a: unknown[]) => put(...a),
    post: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "tok" }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));
vi.mock("@/components/CoverPhotoUpload", () => ({ default: () => null }));
vi.mock("@/components/LocationPicker", () => ({ default: () => null }));

function comercio(extra: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    id: "c1",
    user_id: "u1",
    name: "Bar Uno",
    logo_url: "https://cdn.example/logo-viejo.png",
    cover_photo_url: null,
    category: null,
    description: null,
    address: "Thames 1234",
    city: "Palermo, CABA",
    latitude: -34.58,
    longitude: -58.43,
    capacity: null,
    opening_hours: null,
    rating: 0,
    events_published: 0,
    on_time_payment_rate: 0,
    late_cancellations: 0,
    ...extra,
  };
}

describe("CompanyProfileForm: sólo manda lo que la persona tocó", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it("conserva el logo y la dirección que otra pantalla cambió con el formulario abierto", async () => {
    const enServidor = comercio({
      logo_url: "https://cdn.example/logo-nuevo.png",
      address: "Honduras 5000",
      latitude: -34.59,
    });
    get.mockResolvedValueOnce(comercio()).mockResolvedValue(enServidor);
    put.mockImplementation(async (_p, body) => ({ ...enServidor, ...(body as object) }));

    render(<CompanyProfileForm />);
    const name = await screen.findByLabelText(/Nombre del comercio/);
    fireEvent.change(name, { target: { value: "Bar Dos" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const body = put.mock.calls[0][1];
    expect(body.name).toBe("Bar Dos");
    expect(body.logo_url).toBe("https://cdn.example/logo-nuevo.png");
    expect(body.address).toBe("Honduras 5000");
    expect(body.latitude).toBe(-34.59);
    // La portada no se tocó: no viaja (el backend no la modifica).
    expect("cover_photo_url" in body).toBe(false);
  });
});

describe("changedCompanyFields", () => {
  const base = {
    name: "A",
    logo_url: null,
    cover_photo_url: null,
    address: "x",
    city: "c",
    latitude: 1,
    longitude: 2,
  };

  it("sin cambios no devuelve nada", () => {
    expect(changedCompanyFields({ ...base }, { ...base })).toEqual({});
  });

  it("la ubicación viaja completa y la portada sólo si cambió", () => {
    expect(changedCompanyFields({ ...base, city: "d", cover_photo_url: "u" }, base)).toEqual({
      cover_photo_url: "u",
      address: "x",
      city: "d",
      latitude: 1,
      longitude: 2,
    });
  });
});
