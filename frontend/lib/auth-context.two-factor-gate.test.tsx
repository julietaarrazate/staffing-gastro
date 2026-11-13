import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { bindSessionToken, hasBoundSession } from "@/lib/api";
import type { User } from "@/lib/types";

// Registrar y dar de baja el push son pedidos que la app hace por su cuenta
// al abrir y cerrar la sesión (docs/reference/ACCESO_MODERNO.md). A una admin
// sin la verificación en dos pasos el backend le contesta 403 con código en
// cualquier endpoint (ADR-0023), y `AuthProvider` reacciona a ese código
// llevándola al alta o cerrándole la sesión. Esos dos pedidos no pueden
// disparar esa reacción: nadie los pidió desde una pantalla, y el de la baja
// contesta cuando la sesión ya se cerró.
//
// Acá `lib/push` es el real (en `auth-context.test.tsx` va simulado), contra
// un navegador que ya tenía las notificaciones activadas.

const routerReplace = vi.fn();
vi.mock("next/navigation", () => {
  const router = { replace: (...args: unknown[]) => routerReplace(...args) };
  return { useRouter: () => router };
});

const ADMIN: User = {
  id: "u-admin",
  email: "admin@example.com",
  full_name: "Admin de prueba",
  role: "admin",
  status: "active",
  is_verified: true,
};

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/navegador-de-la-admin";
const SUBSCRIPTION_JSON = { endpoint: ENDPOINT, keys: { p256dh: "p", auth: "a" } };

function candado(code: string): [number, unknown] {
  return [403, { detail: { code, message: "Falta la verificación en dos pasos." } }];
}

/** Respuestas del backend por "MÉTODO /ruta": `[status, body]`. */
let backend: Record<string, [number, unknown?]>;
let answered: { request: string; response: Response }[];
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const request = `${init.method} ${url.replace(/^.*\/api\/v1/, "")}`;
  const [status, body] = backend[request] ?? [404];
  const response = new Response(status === 204 ? null : JSON.stringify(body ?? { detail: "sin ruta" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  answered.push({ request, response });
  return response;
});

function requestsSent(): string[] {
  return fetchMock.mock.calls.map(
    ([url, init]) => `${init.method} ${url.replace(/^.*\/api\/v1/, "")}`
  );
}

/** Espera a que la app termine de leer la respuesta a `request` (el 403 con
 * código) y a que corra lo que haga con ella. */
async function settled(request: string) {
  await waitFor(() => {
    const found = answered.find((a) => a.request === request);
    expect(found?.response.bodyUsed).toBe(true);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountApp() {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return () => result.current;
}

beforeEach(() => {
  routerReplace.mockReset();
  fetchMock.mockClear();
  answered = [];
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  backend = { "POST /auth/logout": [204] };

  // El navegador ya tenía las notificaciones activadas: service worker
  // registrado, permiso concedido y una suscripción.
  const registration = {
    pushManager: {
      getSubscription: async () => ({ endpoint: ENDPOINT, toJSON: () => SUBSCRIPTION_JSON }),
    },
    getNotifications: async () => [],
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => registration },
  });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  bindSessionToken(null);
});

describe("el push no dispara el candado de dos pasos de la admin", () => {
  it("admin con el alta pendiente: iniciar sesión no la lleva al alta por el registro del push", async () => {
    backend["POST /auth/login"] = [200, { access_token: "token-admin", user: ADMIN }];
    backend["POST /push/subscribe"] = candado("two_factor_setup_required");
    const auth = await mountApp();

    await act(async () => {
      await auth().login(ADMIN.email, "una-clave");
    });
    await settled("POST /push/subscribe");

    // El registro salió y el backend lo rechazó, pero eso solo no mueve nada:
    // al alta la lleva el primer pedido que haga una pantalla, como siempre.
    expect(requestsSent()).toEqual(["POST /auth/login", "POST /push/subscribe"]);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(auth().twoFactorSetupPending).toBe(false);
    expect(auth().user?.id).toBe(ADMIN.id);
  });

  it("sesión admin de antes de activar la verificación: abrir la app no la cierra por el registro del push", async () => {
    localStorage.setItem("staffya_token", "token-viejo");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [200, ADMIN];
    backend["POST /push/subscribe"] = candado("two_factor_required");

    const auth = await mountApp();
    await settled("POST /push/subscribe");

    expect(requestsSent()).toEqual(["GET /auth/me", "POST /push/subscribe"]);
    expect(auth().user?.id).toBe(ADMIN.id);
    expect(localStorage.getItem("staffya_token")).toBe("token-viejo");
    expect(hasBoundSession()).toBe(true);
  });

  it.each(["two_factor_setup_required", "two_factor_required"])(
    "cerrar sesión con la baja frenada por el candado (%s) termina en la landing",
    async (code) => {
      backend["POST /auth/login"] = [200, { access_token: "token-admin", user: ADMIN }];
      backend["POST /push/subscribe"] = [201, { ok: true }];
      backend["DELETE /push/subscribe"] = candado(code);
      const auth = await mountApp();
      await act(async () => {
        await auth().login(ADMIN.email, "una-clave");
      });
      await settled("POST /push/subscribe");
      fetchMock.mockClear();

      await act(async () => {
        await auth().logout();
      });
      await settled("DELETE /push/subscribe");

      // La respuesta de la baja llega con la sesión ya cerrada: no manda al
      // alta ni al login, y no repite el cierre.
      expect(requestsSent().sort()).toEqual(["DELETE /push/subscribe", "POST /auth/logout"]);
      expect(routerReplace.mock.calls).toEqual([["/"]]);
      expect(auth().twoFactorSetupPending).toBe(false);
      expect(auth().user).toBeNull();
      expect(auth().token).toBeNull();
    }
  );
});
