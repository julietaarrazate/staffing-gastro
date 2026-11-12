import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { bindSessionToken, renewSessionToken } from "@/lib/api";
import type { User } from "@/lib/types";

// Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
// abierta ahí (docs/reference/ACCESO_MODERNO.md). Acá se prueba cuándo
// `AuthProvider` registra y da de baja el dispositivo; qué manda cada helper
// está en `lib/push.test.ts`.

const claim = vi.fn();
const release = vi.fn();
vi.mock("@/lib/push", () => ({
  claimPushForAccount: (...args: unknown[]) => claim(...args),
  releasePushFromAccount: (...args: unknown[]) => release(...args),
}));

const routerReplace = vi.fn();
vi.mock("next/navigation", () => {
  const router = { replace: (...args: unknown[]) => routerReplace(...args) };
  return { useRouter: () => router };
});

const TRABAJADORA: User = {
  id: "u-trabajadora",
  email: "trabajadora@example.com",
  full_name: "Trabajadora de prueba",
  role: "worker",
  status: "active",
  is_verified: true,
};
const ADMIN: User = { ...TRABAJADORA, id: "u-admin", email: "admin@example.com", role: "admin" };

/** Respuestas del backend por "MÉTODO /ruta": `[status, body]`. */
let backend: Record<string, [number, unknown?]>;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const [status, body] = backend[`${init.method} ${url.replace(/^.*\/api\/v1/, "")}`] ?? [404];
  return new Response(status === 204 ? null : JSON.stringify(body ?? { detail: "sin ruta" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
});

function requestsSent(): string[] {
  return fetchMock.mock.calls.map(
    ([url, init]) => `${init.method} ${url.replace(/^.*\/api\/v1/, "")}`
  );
}

/** La app abierta: `auth()` es lo que ve cualquier pantalla con `useAuth()`. */
async function mountApp() {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return () => result.current;
}
type App = Awaited<ReturnType<typeof mountApp>>;

async function loginAs(auth: App, user: User, accessToken: string) {
  backend["POST /auth/login"] = [200, { access_token: accessToken, user }];
  await act(async () => {
    await auth().login(user.email, "una-clave");
  });
  expect(auth().user?.id).toBe(user.id);
}

beforeEach(() => {
  claim.mockReset().mockResolvedValue(true);
  release.mockReset().mockResolvedValue(true);
  routerReplace.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  backend = { "POST /auth/logout": [204] };
});

afterEach(() => {
  vi.unstubAllGlobals();
  bindSessionToken(null);
});

describe("AuthProvider: el push es de la cuenta que tiene la sesión abierta", () => {
  it("sin sesión no registra nada", async () => {
    const auth = await mountApp();

    expect(auth().user).toBeNull();
    expect(claim).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("al iniciar sesión registra el dispositivo a nombre de la cuenta que entró", async () => {
    const auth = await mountApp();

    await loginAs(auth, TRABAJADORA, "token-trabajadora");

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-trabajadora");
    expect(release).not.toHaveBeenCalled();
  });

  it("al recuperar la sesión guardada también, una sola vez", async () => {
    localStorage.setItem("staffya_token", "token-guardado");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [200, TRABAJADORA];

    const auth = await mountApp();

    expect(auth().user?.id).toBe(TRABAJADORA.id);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-guardado");
  });

  it("si la sesión guardada ya no sirve, no registra nada", async () => {
    localStorage.setItem("staffya_token", "token-vencido");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [401, { detail: "No autorizado" }];
    backend["POST /auth/refresh"] = [401, { detail: "No autorizado" }];

    const auth = await mountApp();

    expect(auth().user).toBeNull();
    expect(claim).not.toHaveBeenCalled();
  });

  it("al cerrar sesión da de baja el dispositivo con el token vigente", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    // La sesión siguió abierta y el access token se renovó: el del contexto
    // es el de cuando entró (ya vencido); el que sirve es el renovado.
    renewSessionToken("token-renovado");

    await act(async () => {
      await auth().logout();
    });

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith("token-renovado");
    expect(auth().token).toBeNull();
    expect(auth().user).toBeNull();
    expect(routerReplace).toHaveBeenCalledWith("/");
    expect(requestsSent()).toContain("POST /auth/logout");
  });

  it.each([
    ["falla", () => Promise.reject(new Error("sin red"))],
    ["no contesta nunca", () => new Promise<boolean>(() => {})],
  ])("si la baja %s, el cierre de sesión sigue igual", async (_caso, baja) => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    release.mockImplementation(baja);

    await act(async () => {
      await auth().logout();
    });

    expect(release).toHaveBeenCalledWith("token-trabajadora");
    expect(auth().token).toBeNull();
    expect(auth().user).toBeNull();
    expect(localStorage.getItem("staffya_token")).toBeNull();
    expect(localStorage.getItem("staffya_has_session")).toBeNull();
    expect(routerReplace).toHaveBeenCalledWith("/");
    expect(requestsSent()).toContain("POST /auth/logout");
  });

  it("después de cerrar sesión, la cuenta que entra queda con el dispositivo", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    await act(async () => {
      await auth().logout();
    });
    claim.mockClear();

    await loginAs(auth, { ...TRABAJADORA, id: "u-otra", email: "otra@example.com" }, "token-otra");

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-otra");
  });

  it("impersonando no registra ni da de baja; «cerrar sesión» sólo vuelve a la admin", async () => {
    const auth = await mountApp();
    await loginAs(auth, ADMIN, "token-admin");
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-admin");
    claim.mockClear();
    fetchMock.mockClear();

    backend[`POST /admin/users/${TRABAJADORA.id}/impersonate`] = [
      200,
      { access_token: "token-impersonado", user: TRABAJADORA },
    ];
    await act(async () => {
      await auth().impersonate(TRABAJADORA.id);
    });
    expect(auth().user?.id).toBe(TRABAJADORA.id);
    expect(auth().token).toBe("token-impersonado");
    expect(auth().impersonating).not.toBeNull();
    // El dispositivo es de la admin: no pasa a nombre de quien está viendo.
    expect(claim).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();

    await act(async () => {
      await auth().logout();
    });
    expect(auth().user?.id).toBe(ADMIN.id);
    expect(auth().token).toBe("token-admin");
    expect(auth().impersonating).toBeNull();
    // Volver a la cuenta admin no le saca sus avisos ni vuelve a registrar.
    expect(release).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(requestsSent()).not.toContain("POST /auth/logout");

    // El cierre de verdad, ya como admin, sí da de baja el dispositivo.
    await act(async () => {
      await auth().logout();
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith("token-admin");
  });
});
