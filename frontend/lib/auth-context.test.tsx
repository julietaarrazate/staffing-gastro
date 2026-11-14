import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  api,
  ApiError,
  bindSessionToken,
  NetworkError,
  renewSessionToken,
  resolveToken,
} from "@/lib/api";
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

const reloadPage = vi.fn();
vi.mock("@/lib/reload-page", () => ({ reloadPage: () => reloadPage() }));

const emitLiveRefresh = vi.fn();
vi.mock("@/lib/live-refresh", () => ({ emitLiveRefresh: () => emitLiveRefresh() }));

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

/** Respuestas del backend por "MÉTODO /ruta": `[status, body]`, o una promesa
 * de eso cuando la prueba decide en qué momento contesta. */
type Reply = [number, unknown?];
let backend: Record<string, Reply | Promise<Reply>>;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  // Como el navegador: un pedido cortado (el tope de `request`) no contesta.
  const aborted = new Promise<never>((_, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
    );
  });
  const [status, body] =
    (await Promise.race([
      backend[`${init.method} ${url.replace(/^.*\/api\/v1/, "")}`],
      aborted,
    ])) ?? [404];
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
  emitLiveRefresh.mockReset();
  reloadPage.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  sessionStorage.clear();
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

  // El registro no puede adelantarse a la verificación en dos pasos de la
  // admin (ADR-0023): mientras falta el alta o el código, el dispositivo no
  // se registra; sale solo cuando la sesión verificada queda abierta.
  it("admin con el alta de dos pasos pendiente: registra recién al adoptar la sesión verificada", async () => {
    localStorage.setItem("staffya_token", "token-sin-verificar");
    localStorage.setItem("staffya_has_session", "1");
    // `/auth/me` tarda: una pantalla del panel ya pidió sus datos y recibió
    // el 403 del candado antes de que llegara el usuario.
    let answerMe!: (reply: Reply) => void;
    backend["GET /auth/me"] = new Promise<Reply>((resolve) => (answerMe = resolve));
    backend["GET /admin/stats"] = [
      403,
      { detail: { code: "two_factor_setup_required", message: "Activá la verificación" } },
    ];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const auth = () => result.current;
    await waitFor(() => expect(auth().token).toBe("token-sin-verificar"));
    await act(async () => {
      await api.get("/admin/stats", "token-sin-verificar").catch(() => {});
    });
    expect(auth().twoFactorSetupPending).toBe(true);
    await act(async () => {
      answerMe([200, ADMIN]);
    });
    await waitFor(() => expect(auth().user?.id).toBe(ADMIN.id));
    expect(claim).not.toHaveBeenCalled();

    // Terminó el alta: el backend devuelve una sesión verificada.
    await act(async () => {
      await auth().adoptSession(async () => ({ access_token: "token-verificado", user: ADMIN }));
    });

    expect(auth().twoFactorSetupPending).toBe(false);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-verificado");
  });

  it("admin a la que le falta el código: registra recién cuando lo completa", async () => {
    const auth = await mountApp();
    backend["POST /auth/login"] = [
      200,
      { two_factor_required: true, challenge_token: "desafio", expires_in: 300 },
    ];
    await act(async () => {
      await auth().login(ADMIN.email, "una-clave");
    });
    expect(auth().pendingTwoFactor).not.toBeNull();
    expect(auth().user).toBeNull();
    expect(claim).not.toHaveBeenCalled();

    backend["POST /auth/2fa/verify"] = [
      200,
      {
        access_token: "token-verificado",
        user: ADMIN,
        used_recovery_code: false,
        recovery_codes_left: 8,
      },
    ];
    await act(async () => {
      await auth().completeTwoFactor("123456");
    });

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-verificado");
  });
});

// G7: la app siempre sabe si hay sesión (U112, U096, U114, U115).
describe("AuthProvider: la app siempre sabe si hay sesión", () => {
  const SIN_SESION = [401, { detail: "No autorizado" }] as Reply;

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  /** Otra pestaña borró la marca de sesión (los navegadores le avisan a las
   * demás con un evento `storage`). */
  function otherTabClearsSession() {
    localStorage.removeItem("staffya_token");
    localStorage.removeItem("staffya_has_session");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "staffya_has_session",
        oldValue: "1",
        newValue: null,
        storageArea: localStorage,
      })
    );
  }

  describe("renovación rechazada con la sesión en curso", () => {
    it("el contexto queda sin sesión y con el motivo, y el error no es «No autorizado»", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = SIN_SESION;

      let error: unknown;
      await act(async () => {
        error = await api.get("/shifts/mine", auth().token).catch((err) => err);
      });

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe("Tu sesión venció. Volvé a ingresar.");
      expect((error as ApiError).code).toBe("session_expired");
      expect(auth().token).toBeNull();
      expect(auth().user).toBeNull();
      expect(auth().sessionEnded).toBe("vencida");
      expect(auth().justLoggedOut).toBe(false);
      expect(localStorage.getItem("staffya_token")).toBeNull();
      expect(localStorage.getItem("staffya_has_session")).toBeNull();
    });

    it("si el servidor dice que la cuenta está suspendida, el motivo es ese", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = [
        403,
        { detail: { code: "account_suspended", message: "Cuenta suspendida" } },
      ];

      await act(async () => {
        await api.get("/shifts/mine", auth().token).catch(() => {});
      });

      expect(auth().token).toBeNull();
      expect(auth().sessionEnded).toBe("suspendida");
    });

    it("si el servidor no contesta la renovación, la sesión sigue y el error es de conexión", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = [503, { detail: "despertando" }];

      let error: unknown;
      await act(async () => {
        error = await api.get("/shifts/mine", auth().token).catch((err) => err);
      });

      expect(error).toBeInstanceOf(NetworkError);
      expect(auth().token).toBe("token-trabajadora");
      expect(auth().user?.id).toBe(TRABAJADORA.id);
      expect(auth().sessionEnded).toBeNull();
      expect(localStorage.getItem("staffya_has_session")).toBe("1");
    });

    it("la sesión guardada que ya no sirve al abrir la app también deja el motivo", async () => {
      localStorage.setItem("staffya_token", "token-vencido");
      localStorage.setItem("staffya_has_session", "1");
      backend["GET /auth/me"] = SIN_SESION;
      backend["POST /auth/refresh"] = SIN_SESION;

      const auth = await mountApp();

      expect(auth().token).toBeNull();
      expect(auth().sessionEnded).toBe("vencida");
      expect(auth().reconnecting).toBe(false);
    });

    it("al volver a ingresar se limpia el motivo", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = SIN_SESION;
      await act(async () => {
        await api.get("/shifts/mine", auth().token).catch(() => {});
      });
      expect(auth().sessionEnded).toBe("vencida");

      await loginAs(auth, TRABAJADORA, "token-nuevo");

      expect(auth().sessionEnded).toBeNull();
      expect(auth().token).toBe("token-nuevo");
    });

    it("viendo como otra persona, un 401 no cierra la sesión de la admin ni dice «No autorizado»", async () => {
      const auth = await mountApp();
      await loginAs(auth, ADMIN, "token-admin");
      backend["POST /admin/users/u-trabajadora/impersonate"] = [
        200,
        { access_token: "token-viendo-como", user: TRABAJADORA },
      ];
      await act(async () => {
        await auth().impersonate(TRABAJADORA.id);
      });
      backend["GET /shifts/mine"] = SIN_SESION;

      let error: unknown;
      await act(async () => {
        error = await api.get("/shifts/mine", auth().token).catch((err) => err);
      });

      expect((error as ApiError).message).not.toBe("No autorizado");
      expect((error as ApiError).code).toBe("impersonation_expired");
      expect(requestsSent()).not.toContain("POST /auth/refresh");
      expect(auth().sessionEnded).toBeNull();
      expect(auth().impersonating?.adminUser.id).toBe(ADMIN.id);
    });
  });

  describe("servidor dormido al abrir la app", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      backend["GET /auth/me"] = [503, { detail: "despertando" }];
    });

    const meRequests = () => requestsSent().filter((r) => r === "GET /auth/me").length;

    it("no cae a «sin sesión»: queda reconectando, con la sesión guardada intacta", async () => {
      const auth = await mountApp();

      expect(auth().reconnecting).toBe(true);
      expect(auth().user).toBeNull();
      expect(auth().token).toBe("token-guardado");
      expect(auth().sessionEnded).toBeNull();
      expect(localStorage.getItem("staffya_has_session")).toBe("1");
      expect(claim).not.toHaveBeenCalled();
    });

    it("reintenta solo a los 2, 5 y 10 segundos, y después cada 15", async () => {
      await mountApp();
      expect(meRequests()).toBe(1);

      for (const [wait, expected] of [
        [1_900, 1],
        [200, 2],
        [5_100, 3],
        [10_100, 4],
        [14_000, 4],
        [1_100, 5],
        [15_100, 6],
      ]) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(wait);
        });
        expect(meRequests()).toBe(expected);
      }
    });

    it("cuando el servidor despierta, la persona queda adentro y deja de reintentar", async () => {
      const auth = await mountApp();
      backend["GET /auth/me"] = [200, TRABAJADORA];

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });

      expect(auth().user?.id).toBe(TRABAJADORA.id);
      expect(auth().reconnecting).toBe(false);
      expect(claim).toHaveBeenCalledWith("token-guardado");
      // Las pantallas que habían fallado se vuelven a pedir solas, una vez.
      expect(emitLiveRefresh).toHaveBeenCalledTimes(1);
      const sent = meRequests();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(meRequests()).toBe(sent);
    });

    it("con la pestaña oculta no pide nada; al volver a verla, prueba enseguida", async () => {
      const auth = await mountApp();
      act(() => setVisibility("hidden"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(meRequests()).toBe(1);

      backend["GET /auth/me"] = [200, TRABAJADORA];
      await act(async () => {
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(meRequests()).toBe(2);
      await waitFor(() => expect(auth().user?.id).toBe(TRABAJADORA.id));
    });

    it("si mientras tanto la sesión resulta vencida, termina con el motivo", async () => {
      const auth = await mountApp();
      backend["GET /auth/me"] = SIN_SESION;
      backend["POST /auth/refresh"] = SIN_SESION;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });

      expect(auth().reconnecting).toBe(false);
      expect(auth().token).toBeNull();
      expect(auth().sessionEnded).toBe("vencida");
      expect(emitLiveRefresh).not.toHaveBeenCalled();
    });

    it("si la persona ingresa mientras se reintenta, la respuesta vieja no la pisa", async () => {
      const auth = await mountApp();
      let wake: (reply: Reply) => void = () => {};
      backend["GET /auth/me"] = new Promise<Reply>((resolve) => {
        wake = resolve;
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });

      await loginAs(auth, ADMIN, "token-admin");
      await act(async () => {
        wake([200, TRABAJADORA]);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(auth().user?.id).toBe(ADMIN.id);
      expect(auth().token).toBe("token-admin");
      expect(auth().reconnecting).toBe(false);
    });
  });

  // Lo que encontró la revisión independiente: la respuesta de una
  // renovación es de la sesión que había al pedirla.
  describe("una renovación en vuelo no pisa a quien vino después", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    /** Una respuesta que la prueba suelta cuando quiere. */
    function deferred() {
      let release: (reply: Reply) => void = () => {};
      const reply = new Promise<Reply>((resolve) => {
        release = resolve;
      });
      return { reply, release };
    }

    /** Sesión guardada, servidor que despierta con el token ya vencido: el
     * reintento deja una renovación esperando respuesta. */
    async function reconnectingWithRefreshInFlight() {
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      backend["GET /auth/me"] = [503, { detail: "despertando" }];
      const auth = await mountApp();
      const refresh = deferred();
      backend["GET /auth/me"] = SIN_SESION;
      backend["POST /auth/refresh"] = refresh.reply;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });
      expect(requestsSent()).toContain("POST /auth/refresh");
      return { auth, refresh };
    }

    it("si la renovación anterior nunca contesta, el ingreso sale cuando llega a su tope y esa respuesta ya no cuenta", async () => {
      const { auth, refresh } = await reconnectingWithRefreshInFlight();
      backend["POST /auth/login"] = [200, { access_token: "token-admin", user: ADMIN }];

      let entering: Promise<unknown> = Promise.resolve();
      await act(async () => {
        entering = auth().login(ADMIN.email, "una-clave");
        await vi.advanceTimersByTimeAsync(60_000);
      });
      // Un arranque en frío dura cerca de un minuto: todavía espera.
      expect(requestsSent()).not.toContain("POST /auth/login");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_100);
        await entering;
      });
      expect(auth().user?.id).toBe(ADMIN.id);
      // Mientras duró el ingreso no salió otra renovación.
      expect(requestsSent().filter((r) => r === "POST /auth/refresh")).toHaveLength(1);

      await act(async () => {
        refresh.release([200, { access_token: "token-de-la-cuenta-anterior" }]);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(auth().user?.id).toBe(ADMIN.id);
      expect(auth().token).toBe("token-admin");
      expect(auth().sessionEnded).toBeNull();
      expect(resolveToken("token-admin")).toBe("token-admin");
      expect(localStorage.getItem("staffya_token")).toBe("token-admin");
    });

    it("la renovación de la admin que quedó en vuelo no se aplica al pasar a «ver como»", async () => {
      const auth = await mountApp();
      await loginAs(auth, ADMIN, "token-admin");
      const refresh = deferred();
      backend["GET /admin/stats"] = SIN_SESION;
      backend["POST /auth/refresh"] = refresh.reply;
      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = api.get("/admin/stats", auth().token).catch((err) => err);
        await vi.advanceTimersByTimeAsync(0);
      });
      backend["POST /admin/users/u-trabajadora/impersonate"] = [
        200,
        { access_token: "token-viendo-como", user: TRABAJADORA },
      ];
      await act(async () => {
        await auth().impersonate(TRABAJADORA.id);
      });

      let stale: unknown;
      await act(async () => {
        refresh.release([200, { access_token: "token-admin-renovado" }]);
        stale = await pending;
      });

      // El pedido que la esperaba no lee «tu sesión venció»: la sesión de
      // ahora está viva, y ese texto ni siquiera sale como aviso.
      expect(stale).toBeInstanceOf(NetworkError);
      // Los pedidos de la persona que se está viendo salen con su token.
      expect(auth().token).toBe("token-viendo-como");
      expect(resolveToken("token-viendo-como")).toBe("token-viendo-como");
      expect(auth().user?.id).toBe(TRABAJADORA.id);
    });

    it("una renovación de otra sesión todavía en vuelo no se reusa ni se lee como sesión vencida", async () => {
      const auth = await mountApp();
      await loginAs(auth, ADMIN, "token-admin");
      const refresh = deferred();
      backend["GET /admin/stats"] = SIN_SESION;
      backend["POST /auth/refresh"] = refresh.reply;
      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = api.get("/admin/stats", auth().token).catch(() => {});
        await vi.advanceTimersByTimeAsync(0);
      });
      backend["POST /admin/users/u-trabajadora/impersonate"] = [
        200,
        { access_token: "token-viendo-como", user: TRABAJADORA },
      ];
      await act(async () => {
        await auth().impersonate(TRABAJADORA.id);
      });
      // Vuelve a su cuenta (otra vez sesión de la admin, pero ya es otra
      // «mano») y un pedido suyo da 401 con la renovación vieja en vuelo.
      await act(async () => {
        auth().stopImpersonating();
      });
      let error: unknown;
      await act(async () => {
        error = await api.get("/admin/stats", auth().token).catch((err) => err);
      });

      expect(error).toBeInstanceOf(NetworkError);
      expect(auth().sessionEnded).toBeNull();
      expect(auth().user?.id).toBe(ADMIN.id);
      expect(requestsSent().filter((r) => r === "POST /auth/refresh")).toHaveLength(1);

      await act(async () => {
        refresh.release([200, { access_token: "token-admin-renovado" }]);
        await pending;
      });
      expect(auth().user?.id).toBe(ADMIN.id);
    });

    it("el ingreso espera a la renovación en vuelo antes de salir", async () => {
      const { auth, refresh } = await reconnectingWithRefreshInFlight();
      backend["POST /auth/login"] = [200, { access_token: "token-admin", user: ADMIN }];

      let entering: Promise<unknown> = Promise.resolve();
      await act(async () => {
        entering = auth().login(ADMIN.email, "una-clave");
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(requestsSent()).not.toContain("POST /auth/login");

      await act(async () => {
        refresh.release(SIN_SESION);
        await entering;
      });
      expect(requestsSent()).toContain("POST /auth/login");
      expect(auth().user?.id).toBe(ADMIN.id);
      expect(auth().sessionEnded).toBeNull();
    });

    it("mientras alguien ingresa no arranca otra renovación", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      const entering = deferred();
      backend["POST /auth/login"] = entering.reply;
      backend["GET /shifts/mine"] = SIN_SESION;

      let login: Promise<unknown> = Promise.resolve();
      let error: unknown;
      await act(async () => {
        login = auth().login(ADMIN.email, "una-clave");
        await vi.advanceTimersByTimeAsync(0);
        error = await api.get("/shifts/mine", auth().token).catch((err) => err);
      });

      expect(error).toBeInstanceOf(NetworkError);
      expect(requestsSent()).not.toContain("POST /auth/refresh");
      expect(auth().user?.id).toBe(TRABAJADORA.id);

      await act(async () => {
        entering.release([200, { access_token: "token-admin", user: ADMIN }]);
        await login;
      });
      expect(auth().user?.id).toBe(ADMIN.id);
    });

    it("cerrar sesión con una renovación en vuelo: no revive la sesión y la salida va después", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      const refresh = deferred();
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = refresh.reply;
      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = api.get("/shifts/mine", auth().token).catch(() => {});
        await vi.advanceTimersByTimeAsync(0);
      });

      let leaving: Promise<unknown> = Promise.resolve();
      await act(async () => {
        leaving = auth().logout();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(auth().token).toBeNull();
      expect(requestsSent()).not.toContain("POST /auth/logout");

      await act(async () => {
        refresh.release([200, { access_token: "token-renovado" }]);
        await pending;
        await leaving;
      });

      expect(auth().token).toBeNull();
      expect(auth().user).toBeNull();
      expect(auth().justLoggedOut).toBe(true);
      expect(localStorage.getItem("staffya_token")).toBeNull();
      expect(localStorage.getItem("staffya_has_session")).toBeNull();
      const sent = requestsSent();
      expect(sent.indexOf("POST /auth/logout")).toBeGreaterThan(sent.indexOf("POST /auth/refresh"));
    });

    it("al abrir, una renovación lenta no se repite ni se corta: los reintentos la reusan", async () => {
      localStorage.setItem("staffya_has_session", "1");
      const refresh = deferred();
      backend["POST /auth/refresh"] = refresh.reply;
      backend["GET /auth/me"] = [200, TRABAJADORA];
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      const refreshes = () => requestsSent().filter((r) => r === "POST /auth/refresh").length;

      // A los 12 segundos la app deja de esperar, pero el pedido sigue.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_100);
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.reconnecting).toBe(true);
      const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/auth/refresh"))!;
      expect(init.signal?.aborted ?? false).toBe(false);

      // Reintentos a los 2 y 5 segundos: ninguno manda otra renovación.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_100);
      });
      expect(refreshes()).toBe(1);

      await act(async () => {
        refresh.release([200, { access_token: "token-renovado" }]);
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(refreshes()).toBe(1);
      expect(result.current.user?.id).toBe(TRABAJADORA.id);
      expect(result.current.token).toBe("token-renovado");
      expect(result.current.reconnecting).toBe(false);
    });
  });

  describe("otra pestaña ingresa con otra cuenta", () => {
    /** Lo que hace otra pestaña al abrir una sesión: guarda de quién es. */
    function otherTabSignsInAs(userId: string | null) {
      const oldValue = localStorage.getItem("staffya_session_user");
      if (userId) localStorage.setItem("staffya_session_user", userId);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_session_user",
          oldValue,
          newValue: userId,
          storageArea: localStorage,
        })
      );
    }

    it("esta pestaña se recarga: su cookie de renovación ya es de la otra cuenta", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      expect(localStorage.getItem("staffya_session_user")).toBe(TRABAJADORA.id);

      act(() => otherTabSignsInAs(ADMIN.id));

      expect(reloadPage).toHaveBeenCalledTimes(1);
    });

    it("si es la misma cuenta, no pasa nada", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => otherTabSignsInAs(TRABAJADORA.id));

      expect(reloadPage).not.toHaveBeenCalled();
      expect(auth().user?.id).toBe(TRABAJADORA.id);
    });

    it("sin sesión acá, no se recarga", async () => {
      await mountApp();

      act(() => otherTabSignsInAs(ADMIN.id));

      expect(reloadPage).not.toHaveBeenCalled();
    });

    it("la sesión recuperada al abrir también deja dicho de quién es", async () => {
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      backend["GET /auth/me"] = [200, TRABAJADORA];

      await mountApp();

      expect(localStorage.getItem("staffya_session_user")).toBe(TRABAJADORA.id);
      act(() => otherTabSignsInAs(ADMIN.id));
      expect(reloadPage).toHaveBeenCalledTimes(1);
    });

    it("si ingresa mientras esta pestaña todavía se estaba abriendo, no le pisa la cuenta: se recarga ésta", async () => {
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      localStorage.setItem("staffya_session_user", TRABAJADORA.id);
      let answer: (reply: Reply) => void = () => {};
      backend["GET /auth/me"] = new Promise<Reply>((resolve) => {
        answer = resolve;
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      // La otra pestaña ingresa con otra cuenta antes de que conteste.
      localStorage.setItem("staffya_token", "token-admin");
      localStorage.setItem("staffya_session_user", ADMIN.id);
      await act(async () => {
        answer([200, TRABAJADORA]);
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(localStorage.getItem("staffya_session_user")).toBe(ADMIN.id);
      expect(result.current.user).toBeNull();
      expect(reloadPage).toHaveBeenCalledTimes(1);
    });

    it("al cerrar sesión se borra de quién era", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      await act(async () => {
        await auth().logout();
      });

      expect(localStorage.getItem("staffya_session_user")).toBeNull();
      act(() => otherTabSignsInAs(ADMIN.id));
      expect(reloadPage).not.toHaveBeenCalled();
    });
  });

  describe("alta de los dos pasos (adoptSession)", () => {
    it("el pedido del alta sale después de la renovación que estuviera en vuelo", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const auth = await mountApp();
      await loginAs(auth, ADMIN, "token-admin");
      let releaseRefresh: (reply: Reply) => void = () => {};
      backend["GET /admin/stats"] = SIN_SESION;
      backend["POST /auth/refresh"] = new Promise<Reply>((resolve) => {
        releaseRefresh = resolve;
      });
      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = api.get("/admin/stats", auth().token).catch(() => {});
        await vi.advanceTimersByTimeAsync(0);
      });

      const order: string[] = [];
      let adopting: Promise<unknown> = Promise.resolve();
      await act(async () => {
        adopting = auth().adoptSession(async () => {
          order.push("alta");
          return { access_token: "token-verificado", user: ADMIN };
        });
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(order).toEqual([]);

      await act(async () => {
        backend["GET /admin/stats"] = [200, {}];
        releaseRefresh([200, { access_token: "token-admin-renovado" }]);
        await pending;
        await adopting;
      });

      expect(order).toEqual(["alta"]);
      expect(auth().token).toBe("token-verificado");
      expect(resolveToken("token-verificado")).toBe("token-verificado");
    });
  });

  describe("otra pestaña cierra la sesión", () => {
    it("esta también queda sin sesión, como una salida, sin volver a llamar al servidor", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      fetchMock.mockClear();

      act(() => otherTabClearsSession());

      expect(auth().token).toBeNull();
      expect(auth().user).toBeNull();
      expect(auth().justLoggedOut).toBe(true);
      expect(auth().sessionEnded).toBeNull();
      expect(requestsSent()).toEqual([]);
      expect(release).not.toHaveBeenCalled();
    });

    it("si a la otra se le venció, acá también se dice que venció", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => {
        localStorage.setItem("staffya_session_end", "vencida");
        otherTabClearsSession();
      });

      expect(auth().token).toBeNull();
      expect(auth().sessionEnded).toBe("vencida");
      expect(auth().justLoggedOut).toBe(false);
    });

    it("sin sesión acá, el aviso de otra pestaña no hace nada", async () => {
      const auth = await mountApp();

      act(() => otherTabClearsSession());

      expect(auth().justLoggedOut).toBe(false);
      expect(auth().sessionEnded).toBeNull();
    });

    it("un cambio en otra clave no cierra nada", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "oido-theme",
            newValue: "dark",
            storageArea: localStorage,
          })
        );
      });

      expect(auth().token).toBe("token-trabajadora");
    });
  });
});
