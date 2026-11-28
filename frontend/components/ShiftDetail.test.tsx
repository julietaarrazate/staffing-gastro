import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationStatus, ShiftPublic } from "@/lib/types";
import ShiftDetail from "./ShiftDetail";
import { emitLiveRefresh } from "@/lib/live-refresh";
import { ApiError } from "@/lib/api";

/**
 * La acción del detalle de turno cambia según quién lo mira. El bug que motivó
 * este test: la página le decía "Postulate en Oído" (→ registro) a un
 * trabajador ya logueado que llegaba tocando un turno del home. `/turno/[id]`
 * se arma en el servidor, así que Playwright (API mockeada sólo en el
 * navegador) no puede cubrirlo: acá se prueba el componente.
 */

const auth = vi.hoisted(() => ({
  value: { user: null as null | { role: string }, token: null as null | string, loading: false },
}));
const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/push-prompt-context", () => ({ usePushPrompt: () => ({ requestOptIn: vi.fn() }) }));
vi.mock("@/components/ui", async (importOriginal) => ({
  // La portada de cielo y el sello de confianza son los de verdad.
  ...(await importOriginal<typeof import("@/components/ui")>()),
  Skeleton: () => <div data-testid="skeleton" />,
  useToast: () => vi.fn(),
}));
vi.mock("@/components/MiniMap", () => ({ default: () => null }));
// La brocha y Mansalva salen de next/font, que no corre en Vitest.
vi.mock("@/lib/letras", () => ({ LETRAS_APP: "" }));
vi.mock("@/components/worker/SaveShiftButton", () => ({ default: () => null }));
vi.mock("@/components/ShareShiftButton", () => ({
  default: ({ vidrio }: { vidrio?: boolean }) => (
    <button type="button" data-vidrio={String(Boolean(vidrio))}>
      Compartir
    </button>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

const SHIFT: ShiftPublic = {
  id: "s1",
  position: "mozo",
  start_at: "2026-09-26T23:00:00Z",
  end_at: "2026-09-27T05:00:00Z",
  city: "Palermo",
  pay_amount: "42000.00",
  currency: "ARS",
  company_name: "Tinto",
  tips: false,
  meal: false,
  dress_code: null,
  urgent: false,
};

function mockGets(applications: { shift_id: string; status: ApplicationStatus }[]) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/applications/mine")) return Promise.resolve(applications);
    if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT, tips: true, meal: false, dress_code: null });
    return Promise.reject(new Error(`sin mock: ${path}`));
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth.value = { user: null, token: null, loading: false };
});

describe("ShiftDetail", () => {
  it("sin sesión, la acción lleva al registro con el rol de trabajador elegido", () => {
    render(<ShiftDetail publicShift={SHIFT} />);

    const link = screen.getByRole("link", { name: "Postulate en Oído" });
    // Y vuelve a este turno al terminar el alta (G16).
    expect(link).toHaveAttribute("href", "/register?rol=trabajador&next=%2Fturno%2Fs1");
    expect(screen.getByRole("link", { name: "Ingresá" })).toHaveAttribute("href", "/login?next=%2Fturno%2Fs1");
    expect(screen.getByText(/Creá tu perfil gratis/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("un trabajador logueado se postula ahí mismo, sin pasar por el registro", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    post.mockResolvedValue({ id: "a1" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));

    expect(post).toHaveBeenCalledWith("/applications/shifts/s1", undefined, "tok", undefined, expect.any(String));
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Postulate en Oído" })).not.toBeInTheDocument();
  });

  it("el turno es una hoja: el puesto como título, el pago primero y cuándo y dónde en filas", () => {
    render(<ShiftDetail publicShift={SHIFT} />);
    const hoja = screen.getByRole("region", { name: "El turno" });
    expect(hoja).toHaveClass("hoja");
    // El título va en letra normal: la brocha queda para la cinta.
    const titulo = screen.getByRole("heading", { level: 1, name: "Mozo/a" });
    expect(titulo).toHaveClass("titulo-pantalla");
    expect(titulo).not.toHaveClass("letra-cartel");
    const rotulos = [...hoja.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(rotulos).toEqual(["Pago", "Cuándo", "Dónde"]);
    expect(hoja.querySelector(".turno-pago")).toHaveTextContent("$42.000");
    // Sin postularse no hay cinta.
    expect(hoja.querySelector(".cinta-oido")).toBeNull();
  });

  it("sin foto, la portada es el cielo y no el bloque de color del rubro", () => {
    const { container } = render(<ShiftDetail publicShift={SHIFT} />);
    const portada = container.querySelector("header")!;
    expect(portada.querySelector('[data-portada="portada"]')).not.toBeNull();
    expect(portada.querySelector("img.portada-nube")).not.toBeNull();
    expect(portada.className).not.toMatch(/bg-(brand|glow|wine|skill)/);
  });

  it("con foto del local, la foto va a sangre con el velo y sin la portada de cielo", () => {
    const { container } = render(
      <ShiftDetail
        publicShift={{ ...SHIFT, company_cover_url: "https://res.cloudinary.com/demo/image/upload/v1/local.jpg" }}
      />
    );
    const portada = container.querySelector("header")!;
    expect(portada.querySelector("img")?.getAttribute("src")).toContain("local.jpg");
    expect(portada.querySelector(".portada-velo")).not.toBeNull();
    expect(portada.querySelector("[data-portada]")).toBeNull();
  });

  it("«Compartir» va arriba, de vidrio; «Volver» sólo con sesión; «Urgente» sobre la portada", () => {
    const { container, unmount } = render(<ShiftDetail publicShift={{ ...SHIFT, urgent: true }} />);
    const portada = container.querySelector("header")!;
    expect(portada.querySelector("button[data-vidrio]")).toHaveAttribute("data-vidrio", "true");
    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument();
    expect(portada.querySelector(".chip-foto-urgente")).toHaveTextContent("Urgente");
    unmount();

    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    render(<ShiftDetail publicShift={SHIFT} />);
    const volver = screen.getByRole("button", { name: "Volver" });
    expect(volver).toHaveClass("boton-vidrio", "sobre-foto");
  });

  it("la acción va fija abajo y es el único ámbar de la pantalla", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    const { container } = render(<ShiftDetail publicShift={SHIFT} />);
    const boton = await screen.findByRole("button", { name: "Postularme" });
    const barra = screen.getByTestId("turno-accion");
    expect(barra).toContainElement(boton);
    expect(barra).toHaveClass("sticky");
    expect(container.querySelectorAll(".boton-relieve, .bg-primary")).toHaveLength(1);
  });

  it("una foto que falla cae al cielo, y si después llega otra foto, esa se muestra", () => {
    const base = "https://res.cloudinary.com/demo/image/upload/v1/";
    const { container, rerender } = render(
      <ShiftDetail publicShift={{ ...SHIFT, company_cover_url: `${base}rota.jpg` }} />
    );
    fireEvent.error(container.querySelector("header img")!);
    expect(container.querySelector('header [data-portada="portada"]')).not.toBeNull();
    rerender(<ShiftDetail publicShift={{ ...SHIFT, company_cover_url: `${base}buena.jpg` }} />);
    expect(container.querySelector("header [data-portada]")).toBeNull();
    expect(container.querySelector("header img")?.getAttribute("src")).toContain("buena.jpg");
  });

  it("si la acción ocupa demasiado de la pantalla (letra muy grande), se despega", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    const alto = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
    try {
      render(<ShiftDetail publicShift={SHIFT} />);
      await screen.findByRole("button", { name: "Postularme" });
      // 500 px de 768 (la ventana de jsdom): más del 40 %.
      await waitFor(() => expect(screen.getByTestId("turno-accion")).not.toHaveClass("sticky"));
      expect(document.documentElement.style.scrollPaddingBottom).toBe("");
    } finally {
      alto.mockRestore();
    }
  });

  it("mientras está pegada, el foco no queda debajo: reserva su alto al llevar algo a la vista", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    const alto = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(92);
    try {
      const { unmount } = render(<ShiftDetail publicShift={SHIFT} />);
      await screen.findByRole("button", { name: "Postularme" });
      expect(screen.getByTestId("turno-accion")).toHaveClass("sticky");
      expect(document.documentElement.style.scrollPaddingBottom).toBe("92px");
      unmount();
      expect(document.documentElement.style.scrollPaddingBottom).toBe("");
    } finally {
      alto.mockRestore();
    }
  });

  it("si la foto ya había fallado antes de que la pantalla cobrara vida, cae al cielo", () => {
    const completa = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    try {
      const { container } = render(
        <ShiftDetail
          publicShift={{ ...SHIFT, company_cover_url: "https://res.cloudinary.com/demo/image/upload/v1/rota.jpg" }}
        />
      );
      // jsdom no carga imágenes: `naturalWidth` vale 0, como en una rota.
      expect(container.querySelector('header [data-portada="portada"]')).not.toBeNull();
    } finally {
      completa.mockRestore();
    }
  });

  it("a quien no puede hacer nada con el turno (otro comercio) no le deja una barra vacía", async () => {
    auth.value = { user: { role: "employer" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path === "/companies/me/profile") return Promise.resolve({ id: "otra" });
      if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT, company_id: "c1" });
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    render(<ShiftDetail publicShift={SHIFT} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/companies/me/profile", "tok"));
    expect(screen.queryByTestId("turno-accion")).not.toBeInTheDocument();
  });

  it("al postularse, la hoja recibe la cinta «¡Oído!» (con el golpe, porque pasó acá)", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    post.mockResolvedValue({ id: "a1" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);
    await user.click(await screen.findByRole("button", { name: "Postularme" }));
    await screen.findByText("Ya te postulaste");
    const cinta = screen.getByRole("region", { name: "El turno" }).querySelector(".cinta-oido");
    expect(cinta).not.toBeNull();
    expect(cinta).toHaveAttribute("aria-hidden", "true");
    expect(cinta).toHaveClass("cinta-oido-pega");
  });

  it("si ya estaba postulado, no le ofrece postularse de nuevo", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([{ shift_id: "s1", status: "pendiente" }]);
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
    // La cinta ya está pegada: sin el golpe, que es para lo que pasa acá.
    const cinta = screen.getByRole("region", { name: "El turno" }).querySelector(".cinta-oido");
    expect(cinta).not.toBeNull();
    expect(cinta).not.toHaveClass("cinta-oido-pega");
  });

  it("si tuvo el turno asignado y lo dejó, no le ofrece postularse ni dice que se postuló (G4)", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([{ shift_id: "s1", status: "desasignada" }]);
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(await screen.findByText("Ya tuviste este turno asignado")).toBeInTheDocument();
    expect(screen.getByText("Si el comercio te vuelve a elegir, te avisamos.")).toBeInTheDocument();
    expect(screen.queryByText("Ya te postulaste")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
  });

  it("con la pestaña vieja, el 409 de quien dejó el turno no se muestra como «Ya te postulaste»", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([]);
    post.mockRejectedValue(
      new ApiError(409, "Ya tuviste este turno asignado. Si el comercio te vuelve a elegir, te avisamos.")
    );
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));

    expect(await screen.findByText("Ya tuviste este turno asignado")).toBeInTheDocument();
    expect(screen.queryByText("Ya te postulaste")).not.toBeInTheDocument();
  });

  it("si retiró la postulación, no dice que sigue postulado: puede postularse de nuevo", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    mockGets([{ shift_id: "s1", status: "retirada" }]);
    post.mockResolvedValue({ id: "a1", status: "pendiente" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    const apply = await screen.findByRole("button", { name: "Postularme" });
    expect(screen.queryByText("Ya te postulaste")).not.toBeInTheDocument();
    await user.click(apply);

    expect(post).toHaveBeenCalledWith("/applications/shifts/s1", undefined, "tok", undefined, expect.any(String));
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
  });

  it("sin sesión ya muestra las condiciones del turno", () => {
    render(<ShiftDetail publicShift={{ ...SHIFT, tips: true, dress_code: "Remera negra" }} />);

    expect(screen.getByText("Qué incluye")).toBeInTheDocument();
    expect(screen.getByText("Propinas")).toBeInTheDocument();
    expect(screen.getByText("Vestimenta: Remera negra")).toBeInTheDocument();
  });

  it("con sesión suma lo que la vista pública no trae (la descripción)", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT, description: "Traer delantal" });
      return Promise.reject(new Error(path));
    });
    render(<ShiftDetail publicShift={SHIFT} />);

    await waitFor(() => expect(screen.getByText("Traer delantal")).toBeInTheDocument());
  });

  it("sin sesión ya muestra la dirección escrita del local y «Cómo llegar» por esa dirección (sin coordenadas)", () => {
    render(<ShiftDetail publicShift={{ ...SHIFT, address: "Gorriti 5000" }} />);

    expect(screen.getByText("Gorriti 5000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=Gorriti%205000%2C%20Palermo"
    );
  });

  it("sin sesión y sin dirección (otra zona o evento) sólo dice la zona y no ofrece «Cómo llegar»", () => {
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(screen.queryByText(/Gorriti/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Cómo llegar" })).toBeNull();
  });

  it("un trabajador con sesión ve la dirección exacta y «Cómo llegar» con la dirección, aunque no haya coordenadas", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      if (path === "/shifts/s1") {
        return Promise.resolve({ ...SHIFT, address: "Gorriti 5000", latitude: null, longitude: null });
      }
      return Promise.reject(new Error(path));
    });
    render(<ShiftDetail publicShift={SHIFT} />);

    await waitFor(() => expect(screen.getByText("Gorriti 5000")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=Gorriti%205000%2C%20Palermo"
    );
  });

  it("con coordenadas, «Cómo llegar» va al punto exacto; ya postulado, la dirección sigue a la vista", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([{ shift_id: "s1", status: "pendiente" }]);
      if (path === "/shifts/s1") {
        return Promise.resolve({ ...SHIFT, address: "Gorriti 5000", latitude: -34.58, longitude: -58.43 });
      }
      return Promise.reject(new Error(path));
    });
    render(<ShiftDetail publicShift={SHIFT} />);

    await waitFor(() => expect(screen.getByText("Gorriti 5000")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=-34.58,-58.43"
    );
  });
});

describe("ShiftDetail: carril urgente (ADR-0032)", () => {
  function conCompromiso(
    commits: boolean,
    applications: { shift_id: string; status: ApplicationStatus; se_ofrecio_para_ya?: boolean }[] = []
  ) {
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve(applications);
      if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT, apply_commits: commits });
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
  }

  it("con apply_commits el botón dice «Puedo ir ya» y no postula hasta confirmar", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(true);
    post.mockResolvedValue({ id: "a1", se_ofrecio_para_ya: true });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Puedo ir ya" }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "¿Podés ir a este turno?" })).toBeInTheDocument();
    expect(screen.getByText(/Si el comercio te acepta, el turno queda confirmado en el momento/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sí, puedo ir" }));
    expect(post).toHaveBeenCalledWith("/applications/shifts/s1", { puedo_ir_ya: true }, "tok", undefined, expect.any(String));
    expect(await screen.findByText("Te ofreciste para este turno.")).toBeInTheDocument();
    expect(screen.getByText("Si te aceptan, queda confirmado.")).toBeInTheDocument();
    expect(screen.queryByText("Ya te postulaste")).not.toBeInTheDocument();
  });

  it("pantalla vieja: el 409 del servidor abre la pregunta y, con «Sí, puedo ir», postula con el reconocimiento", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(false);
    post
      .mockRejectedValueOnce(new ApiError(409, "Este turno empieza pronto: confirmá que podés ir.", "puedo_ir_ya_requerido"))
      .mockResolvedValueOnce({ id: "a1", se_ofrecio_para_ya: true });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));
    expect(await screen.findByRole("dialog", { name: "¿Podés ir a este turno?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí, puedo ir" }));

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith("/applications/shifts/s1", { puedo_ir_ya: true }, "tok", undefined, expect.any(String));
    expect(await screen.findByText("Te ofreciste para este turno.")).toBeInTheDocument();
  });

  it("«Ahora no» no postula y deja el botón para volver a intentarlo", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(true);
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Puedo ir ya" }));
    await user.click(screen.getByRole("button", { name: "Ahora no" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Sí, puedo ir" })).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Puedo ir ya" })).toBeEnabled();
  });

  it("sin apply_commits todo sigue igual: «Postularme», sin pregunta", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(false);
    post.mockResolvedValue({ id: "a1" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
  });

  it("si ya se había ofrecido, al volver a entrar ve que se ofreció", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(true, [{ shift_id: "s1", status: "pendiente", se_ofrecio_para_ya: true }]);
    render(<ShiftDetail publicShift={SHIFT} />);
    expect(await screen.findByText("Te ofreciste para este turno.")).toBeInTheDocument();
  });

  it("se postuló hace 7 horas y faltan 5: el turno compromete ahora, pero dice que se postuló, no que se ofreció", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    conCompromiso(true, [{ shift_id: "s1", status: "pendiente", se_ofrecio_para_ya: false }]);
    render(<ShiftDetail publicShift={SHIFT} />);
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByText(/Te ofreciste/)).not.toBeInTheDocument();
    expect(screen.queryByText(/queda confirmado/)).not.toBeInTheDocument();
  });
});

describe("ShiftDetail: respuesta vieja de una recarga silenciosa", () => {
  it("una lista de postulaciones que salió antes de postularse no vuelve a ofrecer «Postularme»", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    let calls = 0;
    let soltarVieja: (value: unknown[]) => void = () => {};
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) {
        calls += 1;
        // La 1ª (carga inicial) contesta ya; la 2ª (recarga por un aviso) queda en vuelo.
        return calls === 1 ? Promise.resolve([]) : new Promise((resolve) => (soltarVieja = resolve));
      }
      if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT });
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    post.mockResolvedValue({ id: "a1" });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);
    const boton = await screen.findByRole("button", { name: "Postularme" });

    act(() => emitLiveRefresh());
    await waitFor(() => expect(calls).toBe(2), { timeout: 3000 });

    await user.click(boton);
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();

    // Llega la respuesta vieja, sin la postulación: no pisa lo ya hecho.
    await act(async () => soltarVieja([]));
    expect(screen.getByText("Ya te postulaste")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
  });
});

describe("ShiftDetail: aviso durante la primera carga", () => {
  it("la recarga espera a que termine la primera y, si ésta falla, el botón no queda en esqueleto", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    let calls = 0;
    let fallarPrimera: (e: Error) => void = () => {};
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) {
        calls += 1;
        return new Promise((_, reject) => (fallarPrimera = reject));
      }
      if (path === "/shifts/s1") return Promise.resolve({ ...SHIFT });
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    render(<ShiftDetail publicShift={SHIFT} />);
    await waitFor(() => expect(calls).toBe(1));

    act(() => emitLiveRefresh());
    await new Promise((r) => setTimeout(r, 700)); // más que el debounce
    expect(calls).toBe(1); // la silenciosa no arrancó pisando a la primera

    await act(async () => fallarPrimera(new Error("red")));
    expect(await screen.findByRole("button", { name: "Postularme" })).toBeInTheDocument();
  });
});

describe("ShiftDetail: turno que ya no está disponible (VIE-03)", () => {
  it("si el servidor contesta 404 al pedir el turno, dice que ya no está y no ofrece «Postularme»", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      if (path === "/shifts/s1") return Promise.reject(new ApiError(404, "Turno no encontrado"));
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(await screen.findByRole("heading", { name: "Este turno ya no está disponible" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver otros turnos" })).toHaveAttribute("href", "/feed");
  });

  it("un error que no es 404 deja la vista pública y el botón", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      if (path === "/shifts/s1") return Promise.reject(new ApiError(500, "Error"));
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    render(<ShiftDetail publicShift={SHIFT} />);

    expect(await screen.findByRole("button", { name: "Postularme" })).toBeInTheDocument();
    expect(screen.queryByText("Este turno ya no está disponible")).not.toBeInTheDocument();
  });

  it("tras un error al postularse relee el turno: si ya no está, lo dice en lugar de dejar el botón", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    let cerrado = false;
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([]);
      if (path === "/shifts/s1") {
        return cerrado ? Promise.reject(new ApiError(404, "Turno no encontrado")) : Promise.resolve({ ...SHIFT });
      }
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    post.mockImplementation(() => {
      cerrado = true; // se cubrió mientras la pantalla seguía abierta
      return Promise.reject(new ApiError(404, "Turno no encontrado o no disponible para postularse"));
    });
    const user = userEvent.setup();
    render(<ShiftDetail publicShift={SHIFT} />);

    await user.click(await screen.findByRole("button", { name: "Postularme" }));

    expect(await screen.findByRole("heading", { name: "Este turno ya no está disponible" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postularme" })).not.toBeInTheDocument();
  });

  it("quien ya se postuló no ve el aviso aunque el pedido del turno falle con 404", async () => {
    auth.value = { user: { role: "worker" }, token: "tok", loading: false };
    get.mockImplementation((path: string) => {
      if (path.startsWith("/applications/mine")) return Promise.resolve([{ shift_id: "s1", status: "pendiente" }]);
      if (path === "/shifts/s1") return Promise.reject(new ApiError(404, "Turno no encontrado"));
      return Promise.reject(new Error(`sin mock: ${path}`));
    });
    render(<ShiftDetail publicShift={SHIFT} />);
    expect(await screen.findByText("Ya te postulaste")).toBeInTheDocument();
  });
});
