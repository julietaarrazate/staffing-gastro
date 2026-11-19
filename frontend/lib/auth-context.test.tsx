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
import { CANDADO_RENOVACION } from "@/lib/candado-renovacion";
import {
  instalarCandadoDeMentira,
  type CandadoDeMentira,
} from "@/lib/testing/candado-de-mentira";
import { getCached, setCached } from "@/lib/screen-cache";
import type { User } from "@/lib/types";

// Las notificaciones de un dispositivo son de la cuenta que tiene la sesión
// abierta ahí (docs/reference/ACCESO_MODERNO.md). Acá se prueba cuándo
// `AuthProvider` registra y da de baja el dispositivo; qué manda cada helper
// está en `lib/push.test.ts`.

const claim = vi.fn();
const release = vi.fn();
const retryReleases = vi.fn();
vi.mock("@/lib/push", () => ({
  claimPushForAccount: (...args: unknown[]) => claim(...args),
  releasePushFromAccount: (...args: unknown[]) => release(...args),
  retryPendingPushReleases: (...args: unknown[]) => retryReleases(...args),
}));

const restartAtHome = vi.fn();
vi.mock("@/lib/restart-at-home", () => ({
  restartAtHome: () => restartAtHome(),
}));

const emitLiveRefresh = vi.fn();
vi.mock("@/lib/live-refresh", () => ({
  emitLiveRefresh: () => emitLiveRefresh(),
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
const ADMIN: User = {
  ...TRABAJADORA,
  id: "u-admin",
  email: "admin@example.com",
  role: "admin",
};

/** Respuestas del backend por "MÉTODO /ruta": `[status, body]`, o una promesa
 * de eso cuando la prueba decide en qué momento contesta. */
type Reply = [number, unknown?];
let backend: Record<string, Reply | Promise<Reply>>;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  // Como el navegador: un pedido cortado (el tope de `request`) no contesta.
  const aborted = new Promise<never>((_, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );
  });
  const [status, body] = (await Promise.race([
    backend[`${init.method} ${url.replace(/^.*\/api\/v1/, "")}`],
    aborted,
  ])) ?? [404];
  return new Response(
    status === 204 ? null : JSON.stringify(body ?? { detail: "sin ruta" }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
});

function requestsSent(): string[] {
  return fetchMock.mock.calls.map(
    ([url, init]) => `${init.method} ${url.replace(/^.*\/api\/v1/, "")}`,
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
  retryReleases.mockReset().mockResolvedValue(true);
  routerReplace.mockReset();
  emitLiveRefresh.mockReset();
  restartAtHome.mockReset();
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
    expect(claim).toHaveBeenCalledWith("token-trabajadora", TRABAJADORA.id);
    expect(release).not.toHaveBeenCalled();
  });

  it("al recuperar la sesión guardada también, una sola vez", async () => {
    localStorage.setItem("staffya_token", "token-guardado");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [200, TRABAJADORA];

    const auth = await mountApp();

    expect(auth().user?.id).toBe(TRABAJADORA.id);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-guardado", TRABAJADORA.id);
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

  it("al cerrar sesión da de baja el dispositivo para la cuenta que sale, sin el token", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    // La sesión siguió abierta y el access token se renovó (o venció): la
    // baja no depende de ninguno de los dos.
    renewSessionToken("token-renovado");

    await act(async () => {
      await auth().logout();
    });

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(TRABAJADORA.id);
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

    expect(release).toHaveBeenCalledWith(TRABAJADORA.id);
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

    await loginAs(
      auth,
      { ...TRABAJADORA, id: "u-otra", email: "otra@example.com" },
      "token-otra",
    );

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-otra", "u-otra");
  });

  it("impersonando no registra ni da de baja; «cerrar sesión» sólo vuelve a la admin", async () => {
    const auth = await mountApp();
    await loginAs(auth, ADMIN, "token-admin");
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-admin", ADMIN.id);
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
    expect(release).toHaveBeenCalledWith(ADMIN.id);
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
    backend["GET /auth/me"] = new Promise<Reply>(
      (resolve) => (answerMe = resolve),
    );
    backend["GET /admin/stats"] = [
      403,
      {
        detail: {
          code: "two_factor_setup_required",
          message: "Activá la verificación",
        },
      },
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
      await auth().adoptSession(async () => ({
        access_token: "token-verificado",
        user: ADMIN,
      }));
    });

    expect(auth().twoFactorSetupPending).toBe(false);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith("token-verificado", ADMIN.id);
  });

  // La campanita se dibuja y pide cuando hay usuario y NO hay alta pendiente
  // (`Navbar`): si el usuario llega antes que el aviso, hace un pedido que el
  // backend rechaza (U133). Por eso la marca llega en el mismo paso que el
  // usuario, sin esperar al primer 403.
  it("admin sin dos pasos: al recuperar la sesión, el alta pendiente llega con el usuario", async () => {
    localStorage.setItem("staffya_token", "token-sin-verificar");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [
      200,
      { ...ADMIN, two_factor_setup_required: true },
    ];

    const vistos: Array<{ user: boolean; pendiente: boolean }> = [];
    const { result } = renderHook(
      () => {
        const a = useAuth();
        vistos.push({
          user: a.user !== null,
          pendiente: a.twoFactorSetupPending,
        });
        return a;
      },
      { wrapper: AuthProvider },
    );
    await waitFor(() => expect(result.current.user?.id).toBe(ADMIN.id));

    expect(result.current.twoFactorSetupPending).toBe(true);
    // Nunca hubo un render con usuario y sin la marca.
    expect(vistos.filter((v) => v.user && !v.pendiente)).toEqual([]);
    expect(requestsSent()).toEqual(["GET /auth/me"]);
  });

  it("admin sin dos pasos: el login también lo avisa", async () => {
    const auth = await mountApp();
    backend["POST /auth/login"] = [
      200,
      {
        access_token: "token-sin-verificar",
        user: ADMIN,
        two_factor_setup_required: true,
      },
    ];
    await act(async () => {
      await auth().login(ADMIN.email, "una-clave");
    });
    expect(auth().twoFactorSetupPending).toBe(true);
  });

  it("entrar con otra cuenta sin cerrar sesión no hereda el alta pendiente de la admin", async () => {
    const auth = await mountApp();
    backend["POST /auth/login"] = [
      200,
      {
        access_token: "token-sin-verificar",
        user: ADMIN,
        two_factor_setup_required: true,
      },
    ];
    await act(async () => {
      await auth().login(ADMIN.email, "una-clave");
    });
    expect(auth().twoFactorSetupPending).toBe(true);

    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    expect(auth().twoFactorSetupPending).toBe(false);
  });

  it("una cuenta que no tiene el alta pendiente no la marca", async () => {
    localStorage.setItem("staffya_token", "token-guardado");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [
      200,
      { ...ADMIN, two_factor_setup_required: false },
    ];
    const auth = await mountApp();
    expect(auth().user?.id).toBe(ADMIN.id);
    expect(auth().twoFactorSetupPending).toBe(false);
  });

  it("admin a la que le falta el código: registra recién cuando lo completa", async () => {
    const auth = await mountApp();
    backend["POST /auth/login"] = [
      200,
      {
        two_factor_required: true,
        challenge_token: "desafio",
        expires_in: 300,
      },
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
    expect(claim).toHaveBeenCalledWith("token-verificado", ADMIN.id);
  });
});

// G7: la app siempre sabe si hay sesión (U112, U096, U114, U115).
// `/privacidad`: el identificador del dispositivo se borra al cerrar sesión
// en ese dispositivo. También cuando la sesión termina sola, y aunque la baja
// no llegue en el momento (queda pendiente y se reintenta).
describe("AuthProvider: la baja del dispositivo cuando la sesión termina sola", () => {
  const SIN_SESION = [401, { detail: "No autorizado" }] as Reply;
  const SUSPENDIDA = [
    403,
    { detail: { code: "account_suspended", message: "Cuenta suspendida" } },
  ] as Reply;

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it.each([
    ["vencida o revocada", SIN_SESION, "vencida"],
    ["suspendida", SUSPENDIDA, "suspendida"],
  ])(
    "la pestaña que detecta la sesión %s da de baja el dispositivo de esa cuenta",
    async (_caso, rechazo, motivo) => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = SIN_SESION;
      backend["POST /auth/refresh"] = rechazo;

      await act(async () => {
        await api.get("/shifts/mine", auth().token).catch(() => {});
      });

      expect(auth().sessionEnded).toBe(motivo);
      expect(release).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledWith(TRABAJADORA.id);
    },
  );

  it("si la baja falla o no contesta, el fin de la sesión sigue igual", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    release.mockRejectedValue(new Error("sin red"));
    backend["GET /shifts/mine"] = SIN_SESION;
    backend["POST /auth/refresh"] = SIN_SESION;

    await act(async () => {
      await api.get("/shifts/mine", auth().token).catch(() => {});
    });

    expect(release).toHaveBeenCalledWith(TRABAJADORA.id);
    expect(auth().token).toBeNull();
    expect(auth().sessionEnded).toBe("vencida");
  });

  it("la sesión guardada que ya no sirve al abrir la app: baja para la cuenta que la tenía", async () => {
    localStorage.setItem("staffya_token", "token-vencido");
    localStorage.setItem("staffya_has_session", "1");
    localStorage.setItem("staffya_session_user", TRABAJADORA.id);
    backend["GET /auth/me"] = SIN_SESION;
    backend["POST /auth/refresh"] = SIN_SESION;

    const auth = await mountApp();

    expect(auth().sessionEnded).toBe("vencida");
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(TRABAJADORA.id);
    expect(claim).not.toHaveBeenCalled();
  });

  it("viendo como otra persona, el fin que avisa otra pestaña tampoco manda ninguna baja", async () => {
    const auth = await mountApp();
    await loginAs(auth, ADMIN, "token-admin");
    backend[`POST /admin/users/${TRABAJADORA.id}/impersonate`] = [
      200,
      { access_token: "token-impersonado", user: TRABAJADORA },
    ];
    await act(async () => {
      await auth().impersonate(TRABAJADORA.id);
    });
    expect(release).not.toHaveBeenCalled();

    act(() => {
      localStorage.setItem("staffya_session_end", "vencida");
      localStorage.removeItem("staffya_has_session");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_has_session",
          oldValue: "1",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    // Reflejado: no manda nada, ni por la admin ni por la persona vista.
    expect(auth().sessionEnded).toBe("vencida");
    expect(release).not.toHaveBeenCalled();
  });

  // La otra pestaña ya mandó la baja (y si no llegó, la dejó pendiente en
  // `localStorage`, que es de todas). Una segunda en vuelo desde acá podría
  // llegar después de un reingreso y borrar el registro nuevo.
  it.each([
    ["cerró sesión", null],
    ["detectó la sesión vencida", "vencida"],
    ["detectó la cuenta suspendida", "suspendida"],
  ])(
    "si otra pestaña %s, ésta sólo lo refleja: no manda otra baja",
    async (_caso, motivo) => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => {
        if (motivo) localStorage.setItem("staffya_session_end", motivo);
        localStorage.removeItem("staffya_token");
        localStorage.removeItem("staffya_has_session");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "staffya_has_session",
            oldValue: "1",
            newValue: null,
            storageArea: localStorage,
          }),
        );
      });

      expect(auth().token).toBeNull();
      expect(release).not.toHaveBeenCalled();
    },
  );

  it("si la marca desapareció y esta pestaña se entera al renovar, tampoco manda otra baja", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    // La cerraron desde otro lado y el aviso no llegó (pestaña dormida).
    localStorage.removeItem("staffya_has_session");
    backend["GET /shifts/mine"] = SIN_SESION;

    await act(async () => {
      await api.get("/shifts/mine", auth().token).catch(() => {});
    });

    expect(auth().token).toBeNull();
    expect(release).not.toHaveBeenCalled();
  });

  describe("reintento de las bajas pendientes", () => {
    function setVisibility(state: "visible" | "hidden") {
      Object.defineProperty(document, "visibilityState", {
        value: state,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }

    it("al abrir la app sin sesión, reintenta lo pendiente", async () => {
      await mountApp();

      expect(retryReleases).toHaveBeenCalledTimes(1);
      expect(retryReleases).toHaveBeenCalledWith(null);
    });

    it("al abrir la app con una sesión guardada, avisa de quién es para no darla de baja", async () => {
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      localStorage.setItem("staffya_session_user", TRABAJADORA.id);
      backend["GET /auth/me"] = [200, TRABAJADORA];

      await mountApp();

      expect(retryReleases).toHaveBeenCalledTimes(1);
      expect(retryReleases).toHaveBeenCalledWith(TRABAJADORA.id);
    });

    it("cuando vuelve la conexión, reintenta", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      retryReleases.mockClear();

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(retryReleases).toHaveBeenCalledTimes(1);
      // La de la cuenta que está adentro no se manda.
      expect(retryReleases).toHaveBeenCalledWith(TRABAJADORA.id);
    });

    it("cuando la pestaña vuelve al frente, reintenta; al ocultarse, no", async () => {
      await mountApp();
      retryReleases.mockClear();

      act(() => setVisibility("hidden"));
      expect(retryReleases).not.toHaveBeenCalled();

      act(() => setVisibility("visible"));
      expect(retryReleases).toHaveBeenCalledTimes(1);
      expect(retryReleases).toHaveBeenCalledWith(null);
    });

    it("después de cerrar sesión ya no excluye a la cuenta que salió", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      await act(async () => {
        await auth().logout();
      });
      retryReleases.mockClear();

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(retryReleases).toHaveBeenCalledWith(null);
    });

    it("al desmontar deja de escuchar", async () => {
      const { result, unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      unmount();
      retryReleases.mockClear();

      window.dispatchEvent(new Event("online"));
      setVisibility("visible");

      expect(retryReleases).not.toHaveBeenCalled();
    });
  });
});

describe("AuthProvider: la app siempre sabe si hay sesión", () => {
  const SIN_SESION = [401, { detail: "No autorizado" }] as Reply;

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
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
      }),
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
      expect((error as ApiError).message).toBe(
        "Tu sesión venció. Volvé a ingresar.",
      );
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

    const meRequests = () =>
      requestsSent().filter((r) => r === "GET /auth/me").length;

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
      expect(claim).toHaveBeenCalledWith("token-guardado", TRABAJADORA.id);
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
      backend["POST /auth/login"] = [
        200,
        { access_token: "token-admin", user: ADMIN },
      ];

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
      expect(
        requestsSent().filter((r) => r === "POST /auth/refresh"),
      ).toHaveLength(1);

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
      expect(
        requestsSent().filter((r) => r === "POST /auth/refresh"),
      ).toHaveLength(1);

      await act(async () => {
        refresh.release([200, { access_token: "token-admin-renovado" }]);
        await pending;
      });
      expect(auth().user?.id).toBe(ADMIN.id);
    });

    it("el ingreso espera a la renovación en vuelo antes de salir", async () => {
      const { auth, refresh } = await reconnectingWithRefreshInFlight();
      backend["POST /auth/login"] = [
        200,
        { access_token: "token-admin", user: ADMIN },
      ];

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
      expect(sent.indexOf("POST /auth/logout")).toBeGreaterThan(
        sent.indexOf("POST /auth/refresh"),
      );
    });

    it("al abrir, una renovación lenta no se repite ni se corta: los reintentos la reusan", async () => {
      localStorage.setItem("staffya_has_session", "1");
      const refresh = deferred();
      backend["POST /auth/refresh"] = refresh.reply;
      backend["GET /auth/me"] = [200, TRABAJADORA];
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      const refreshes = () =>
        requestsSent().filter((r) => r === "POST /auth/refresh").length;

      // A los 12 segundos la app deja de esperar, pero el pedido sigue.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_100);
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.reconnecting).toBe(true);
      const [, init] = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith("/auth/refresh"),
      )!;
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

  // CON-02: la cookie de renovación es una sola para todo el navegador. Si
  // otra pestaña está renovando, ésta espera a que reciba su respuesta y
  // recién ahí sale, con la cookie que la otra ya rotó.
  describe("otra pestaña está renovando", () => {
    let candado: CandadoDeMentira;
    const refreshes = () =>
      requestsSent().filter((r) => r === "POST /auth/refresh").length;

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      candado = instalarCandadoDeMentira();
    });

    afterEach(() => {
      candado.quitar();
    });

    it("la renovación de esta pestaña sale recién cuando la otra suelta el candado", async () => {
      const otra = candado.tomarComoOtraPestana(CANDADO_RENOVACION);
      localStorage.setItem("staffya_has_session", "1");
      backend["POST /auth/refresh"] = [200, { access_token: "token-renovado" }];
      backend["GET /auth/me"] = [200, TRABAJADORA];
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(refreshes()).toBe(0);

      await act(async () => {
        otra.soltar();
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(refreshes()).toBe(1);
      expect(
        candado.pedidos.filter((n) => n === CANDADO_RENOVACION),
      ).toHaveLength(2);
      await waitFor(() => expect(result.current.user?.id).toBe(TRABAJADORA.id));
      expect(result.current.token).toBe("token-renovado");
      expect(result.current.sessionEnded).toBeNull();
    });

    it("si mientras esperaba otra pestaña ingresó con otra cuenta, no renueva aunque el aviso no haya llegado", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      backend["GET /shifts/mine"] = [401, { detail: "No autorizado" }];
      backend["POST /auth/refresh"] = [
        200,
        { access_token: "token-de-la-otra-cuenta" },
      ];
      const otra = candado.tomarComoOtraPestana(CANDADO_RENOVACION);

      let pedido: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pedido = api.get("/shifts/mine", auth().token).catch((err) => err);
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await act(async () => {
        // La otra pestaña escribió su cuenta; el evento `storage` todavía no llegó.
        localStorage.setItem("staffya_session_user", ADMIN.id);
        otra.soltar();
        await vi.advanceTimersByTimeAsync(100);
        await pedido;
      });

      expect(refreshes()).toBe(0);
      expect(auth().token).toBe("token-trabajadora");
      expect(resolveToken("token-trabajadora")).toBe("token-trabajadora");
    });

    it("si mientras esperaba otra pestaña cerró la sesión, no renueva", async () => {
      const otra = candado.tomarComoOtraPestana(CANDADO_RENOVACION);
      localStorage.setItem("staffya_has_session", "1");
      backend["POST /auth/refresh"] = [
        200,
        { access_token: "token-de-otra-sesion" },
      ];
      backend["GET /auth/me"] = [200, TRABAJADORA];
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      await act(async () => {
        localStorage.removeItem("staffya_has_session");
        otra.soltar();
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(refreshes()).toBe(0);
      expect(result.current.token).toBeNull();
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
        }),
      );
    }

    it("esta pestaña se recarga: su cookie de renovación ya es de la otra cuenta", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");
      expect(localStorage.getItem("staffya_session_user")).toBe(TRABAJADORA.id);

      act(() => otherTabSignsInAs(ADMIN.id));

      expect(restartAtHome).toHaveBeenCalledTimes(1);
    });

    it("si es la misma cuenta, no pasa nada", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => otherTabSignsInAs(TRABAJADORA.id));

      expect(restartAtHome).not.toHaveBeenCalled();
      expect(auth().user?.id).toBe(TRABAJADORA.id);
    });

    it("sin sesión acá, no se recarga", async () => {
      await mountApp();

      act(() => otherTabSignsInAs(ADMIN.id));

      expect(restartAtHome).not.toHaveBeenCalled();
    });

    it("la sesión recuperada al abrir también deja dicho de quién es", async () => {
      localStorage.setItem("staffya_token", "token-guardado");
      localStorage.setItem("staffya_has_session", "1");
      backend["GET /auth/me"] = [200, TRABAJADORA];

      await mountApp();

      expect(localStorage.getItem("staffya_session_user")).toBe(TRABAJADORA.id);
      act(() => otherTabSignsInAs(ADMIN.id));
      expect(restartAtHome).toHaveBeenCalledTimes(1);
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
      expect(restartAtHome).toHaveBeenCalledTimes(1);
    });

    it("una pestaña sin sesión arranca con la que abrió otra pestaña", async () => {
      await mountApp();

      act(() => {
        localStorage.setItem("staffya_token", "token-otra-pestaña");
        localStorage.setItem("staffya_has_session", "1");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "staffya_has_session",
            oldValue: null,
            newValue: "1",
            storageArea: localStorage,
          }),
        );
      });

      expect(restartAtHome).toHaveBeenCalledTimes(1);
    });

    it("con sesión, que otra pestaña escriba la marca no reinicia nada", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "staffya_has_session",
            oldValue: null,
            newValue: "1",
            storageArea: localStorage,
          }),
        );
      });

      expect(restartAtHome).not.toHaveBeenCalled();
      expect(auth().user?.id).toBe(TRABAJADORA.id);
    });

    it("al cerrar sesión se borra de quién era", async () => {
      const auth = await mountApp();
      await loginAs(auth, TRABAJADORA, "token-trabajadora");

      await act(async () => {
        await auth().logout();
      });

      expect(localStorage.getItem("staffya_session_user")).toBeNull();
      act(() => otherTabSignsInAs(ADMIN.id));
      expect(restartAtHome).not.toHaveBeenCalled();
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
          }),
        );
      });

      expect(auth().token).toBe("token-trabajadora");
    });
  });
});

describe("AuthProvider: lo guardado en el navegador es de la cuenta, no de la sesión", () => {
  const BORRADOR = "staffya:borrador:publicar-turno";
  /** Deja en la pestaña lo que una cuenta dejó a medias. */
  function dejarCosasDeLaCuenta() {
    sessionStorage.setItem(BORRADOR, JSON.stringify({ owner: "x" }));
    sessionStorage.setItem("staffya_ai_shift_draft", "{}");
    sessionStorage.setItem("staffya_ai_event_draft", "{}");
    sessionStorage.setItem("staffya_plan_elegido", "pro");
    setCached("worker-feed", { shifts: [] });
  }
  function hayRastros() {
    return [
      sessionStorage.getItem(BORRADOR),
      sessionStorage.getItem("staffya_ai_shift_draft"),
      sessionStorage.getItem("staffya_ai_event_draft"),
      sessionStorage.getItem("staffya_plan_elegido"),
      getCached("worker-feed"),
    ].some((v) => v !== null && v !== undefined);
  }

  it("SES-02: si la sesión vence o se revoca, el borrador de la misma cuenta se conserva", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();

    act(() => {
      localStorage.setItem("staffya_session_end", "vencida");
      localStorage.removeItem("staffya_token");
      localStorage.removeItem("staffya_has_session");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_has_session",
          oldValue: "1",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });
    expect(auth().sessionEnded).toBe("vencida");
    expect(sessionStorage.getItem(BORRADOR)).not.toBeNull();

    await loginAs(auth, TRABAJADORA, "token-2");
    expect(sessionStorage.getItem(BORRADOR)).not.toBeNull();
    expect(sessionStorage.getItem("staffya_ai_shift_draft")).not.toBeNull();
  });

  it("SES-02: «Salir» a propósito sí borra todo", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();

    await act(async () => {
      await auth().logout();
    });

    expect(hayRastros()).toBe(false);
  });

  it("SES-03: si la cuenta sale en otra pestaña, acá no quedan sus borradores ni cachés", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();

    act(() => {
      localStorage.setItem("staffya_session_logout", "1");
      localStorage.removeItem("staffya_token");
      localStorage.removeItem("staffya_has_session");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_has_session",
          oldValue: "1",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    expect(auth().justLoggedOut).toBe(true);
    expect(hayRastros()).toBe(false);
  });

  it("SES-03: si la otra pestaña sólo perdió la marca de sesión (recuperación fallida), no se borra nada", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();

    act(() => {
      localStorage.removeItem("staffya_token");
      localStorage.removeItem("staffya_has_session");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_has_session",
          oldValue: "1",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    expect(auth().user).toBeNull();
    expect(sessionStorage.getItem(BORRADOR)).not.toBeNull();
    expect(sessionStorage.getItem("staffya_ai_shift_draft")).not.toBeNull();
  });

  it("SES-04: recuperar la sesión como otra cuenta (sin pasar por un ingreso) limpia lo de la anterior", async () => {
    sessionStorage.setItem(
      "staffya_ultima_cuenta",
      JSON.stringify(TRABAJADORA.id),
    );
    sessionStorage.setItem("staffya_ai_shift_draft", "{}");
    sessionStorage.setItem("staffya_plan_elegido", "pro");
    localStorage.setItem("staffya_token", "token-guardado");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [200, ADMIN];

    const auth = await mountApp();

    expect(auth().user?.id).toBe(ADMIN.id);
    expect(sessionStorage.getItem("staffya_ai_shift_draft")).toBeNull();
    expect(sessionStorage.getItem("staffya_plan_elegido")).toBeNull();
  });

  it("recuperar la sesión como la misma cuenta conserva sus borradores", async () => {
    sessionStorage.setItem(
      "staffya_ultima_cuenta",
      JSON.stringify(TRABAJADORA.id),
    );
    sessionStorage.setItem("staffya_ai_shift_draft", "{}");
    localStorage.setItem("staffya_token", "token-guardado");
    localStorage.setItem("staffya_has_session", "1");
    backend["GET /auth/me"] = [200, TRABAJADORA];

    await mountApp();

    expect(sessionStorage.getItem("staffya_ai_shift_draft")).not.toBeNull();
  });

  it("SES-04: entrar con otra cuenta sin cerrar sesión limpia lo de la anterior", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();

    await loginAs(auth, ADMIN, "token-admin");

    expect(hayRastros()).toBe(false);
  });

  it("SES-04: tras un vencimiento, entrar con OTRA cuenta también limpia", async () => {
    const auth = await mountApp();
    await loginAs(auth, TRABAJADORA, "token-trabajadora");
    dejarCosasDeLaCuenta();
    act(() => {
      localStorage.setItem("staffya_session_end", "vencida");
      localStorage.removeItem("staffya_token");
      localStorage.removeItem("staffya_has_session");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "staffya_has_session",
          oldValue: "1",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    await loginAs(auth, ADMIN, "token-admin");

    expect(hayRastros()).toBe(false);
  });

  it("SES-04: el desafío de dos pasos pendiente de una cuenta no sobrevive al ingreso de otra", async () => {
    const auth = await mountApp();
    backend["POST /auth/login"] = [
      200,
      { two_factor_required: true, challenge_token: "desafio" },
    ];
    await act(async () => {
      await auth().login(ADMIN.email, "una-clave");
    });
    expect(auth().pendingTwoFactor).not.toBeNull();

    await loginAs(auth, TRABAJADORA, "token-trabajadora");

    expect(auth().pendingTwoFactor).toBeNull();
  });
});
