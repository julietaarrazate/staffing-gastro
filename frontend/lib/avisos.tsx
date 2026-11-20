"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { notificationHref } from "@/lib/notification-link";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/lib/useWebSocket";
import { emitLiveRefresh } from "@/lib/live-refresh";
import { Notification } from "@/lib/types";

/** Piso entre dos recargas por reconexión del socket, por volver a primer plano
 *  o por volver la red (comparten el mismo contador). */
export const RECONNECT_REFRESH_MIN_GAP_MS = 30_000;

/**
 * Los avisos de la cuenta: la lista, el socket que los trae en vivo y lo que
 * se hace con ellos. Vive en el layout raíz, una sola vez, porque es **lo
 * único que escucha los avisos**: cada aviso nuevo y cada reconexión le avisan
 * a las pantallas abiertas (`lib/live-refresh.ts`) para que se pongan al día
 * solas (G1, U013).
 *
 * Hasta el 2026-11-20 todo esto era estado de la campanita, que estaba en el
 * encabezado de todas las pantallas. Con la barra flotante el encabezado se
 * fue del celular y la campanita se dibuja en más de un lugar (el cielo del
 * Inicio y del Panel, la barra de la compu) o en ninguno (el resto de las
 * pantallas del celular, que muestran la cuenta en la pestaña de la barra de
 * abajo): el estado no puede depender de que haya una campanita montada.
 */
type Avisos = {
  /** Hay sesión con la que pedir avisos (falso sin sesión o con el alta de la
   *  verificación en dos pasos del admin pendiente). */
  activo: boolean;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  load: () => void;
  /** Lo marca leído y devuelve a dónde lleva. */
  openNotification: (notification: Notification) => void;
  markAllAsRead: () => Promise<void>;
};

const SIN_AVISOS: Avisos = {
  activo: false,
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,
  load: () => {},
  openNotification: () => {},
  markAllAsRead: async () => {},
};

const AvisosContext = createContext<Avisos>(SIN_AVISOS);

export function useAvisos(): Avisos {
  return useContext(AvisosContext);
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const { token: sessionToken, user, loading: cargandoSesion, twoFactorSetupPending } = useAuth();
  // Con el alta de 2FA del admin pendiente (ADR-0023) el backend rechaza los
  // pedidos de avisos: sin token no carga ni abre el socket (U133). Y hasta
  // que la sesión no está confirmada (`user`) no se sabe si es ese caso: el
  // token guardado aparece antes que la respuesta de `/auth/me`. La campanita
  // del encabezado esperaba lo mismo (se montaba recién con `user`).
  const token = cargandoSesion || !user || twoFactorSetupPending ? null : sessionToken;
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // De qué cuenta es la lista que hay en memoria. El proveedor no se desmonta
  // al salir (la campanita de antes sí): sin esto, quien entra después en el
  // mismo equipo veía los avisos de la cuenta anterior hasta que respondía su
  // propio pedido (revisión del 2026-11-20). Se compara por cuenta y no por
  // token, que también cambia cada vez que la sesión se renueva.
  const cuenta = token ? (user?.id ?? null) : null;
  const [duenio, setDuenio] = useState<string | null>(null);
  const cuentaRef = useRef<string | null>(cuenta);
  cuentaRef.current = cuenta;
  useEffect(() => {
    setNotifications([]);
    setError(null);
    setLoading(true);
    setDuenio(cuenta);
  }, [cuenta]);
  // La primera apertura del socket coincide con la carga inicial; desde la
  // segunda es una reconexión (ver `useWebSocket`).
  const hasOpenedOnce = useRef(false);
  // Última vez que una reapertura valió como «reconexión» (recargar y emitir).
  // Un socket que abre y se cierra enseguida (el backend acepta y cierra con
  // 1013/1008) reabre cada pocos segundos: sin este piso sería una recarga de
  // toda pantalla por cada reapertura, o sea una consulta periódica.
  const lastReconnectAt = useRef(0);
  useEffect(() => {
    // Otra sesión (salir y entrar sin desmontar): vuelve a ser la primera
    // apertura.
    hasOpenedOnce.current = false;
    lastReconnectAt.current = 0;
  }, [token]);

  const load = useCallback(() => {
    if (!token) return;
    // La respuesta sólo vale si la cuenta sigue siendo la que la pidió.
    const pidio = cuentaRef.current;
    const vigente = () => cuentaRef.current === pidio;
    setError(null);
    api
      .get<Notification[]>("/notifications", token)
      .then((lista) => {
        if (vigente()) setNotifications(lista);
      })
      .catch((err) => {
        if (vigente()) setError(getErrorMessage(err, "No pudimos cargar tus notificaciones"));
      })
      .finally(() => {
        if (vigente()) setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // VIE-04: el celular vuelve de horas en segundo plano, o vuelve la red, y el
  // socket pudo haberse perdido avisos (o quedar muerto sin cerrarse). Relectura
  // barata en esos dos eventos, con el mismo piso que la reconexión: un
  // `visibilitychange` seguido de `online`, o de la reapertura del socket, es
  // una sola recarga.
  useEffect(() => {
    if (!token) return;
    function refreshIfStale(emit: boolean) {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastReconnectAt.current < RECONNECT_REFRESH_MIN_GAP_MS) return;
      lastReconnectAt.current = now;
      load();
      if (emit) emitLiveRefresh();
    }
    // Las pantallas abiertas ya se ponen al día solas al volver a primer plano
    // (`useLiveRefresh`): acá sólo los avisos. Al volver la red no, y ahí sí
    // se les avisa.
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshIfStale(false);
    };
    const onOnline = () => refreshIfStale(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [token, load]);

  useWebSocket<Notification | { type: "live_refresh" }>(
    token ? "/notifications/ws" : null,
    token,
    (frame) => {
      // Cuadro que no es un aviso (sin id ni texto): sólo pide que las
      // pantallas se pongan al día, p. ej. cuando alguien retira su
      // postulación (VIE-01). No entra en la lista.
      if (!frame || typeof frame !== "object") return;
      if (!("id" in frame)) {
        emitLiveRefresh();
        return;
      }
      const notification = frame;
      setNotifications((prev) =>
        prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]
      );
      emitLiveRefresh();
    },
    () => {
      if (!hasOpenedOnce.current) {
        hasOpenedOnce.current = true;
        return;
      }
      // Reconexión: pudo haber pasado algo mientras el socket estaba caído.
      const now = Date.now();
      if (now - lastReconnectAt.current < RECONNECT_REFRESH_MIN_GAP_MS) return;
      lastReconnectAt.current = now;
      load();
      emitLiveRefresh();
    }
  );

  // U017: con la conversación abierta, los avisos de mensaje de ESA
  // conversación (los que ya estaban y los que llegan en vivo) se leen en el
  // acto: se marcan leídos y no suman a la cuenta. Sólo con la pestaña a la
  // vista (un chat abierto en segundo plano no leyó nada).
  const markedForChat = useRef(new Set<string>());
  // Cambia al volver a ver la pestaña: ahí se marcan los avisos que llegaron
  // mientras estaba oculta.
  const [visibleTick, setVisibleTick] = useState(0);
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") setVisibleTick((t) => t + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  useEffect(() => {
    if (!token || !pathname.startsWith("/chats/")) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const pending = notifications.filter(
      (n) =>
        !n.read &&
        n.type === "chat_message" &&
        n.link?.split(/[?#]/)[0] === pathname &&
        !markedForChat.current.has(n.id)
    );
    if (pending.length === 0) return;
    const ids = new Set(pending.map((n) => n.id));
    pending.forEach((n) => markedForChat.current.add(n.id));
    setNotifications((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)));
    // En silencio, como `markAsRead`: si falla, el aviso sigue sin leer en el
    // servidor y se muestra así en la próxima carga.
    pending.forEach((n) => {
      api.post(`/notifications/${n.id}/read`, undefined, token).catch(() => {});
    });
  }, [token, pathname, notifications, visibleTick]);

  const markAsRead = useCallback(
    async (notification: Notification) => {
      if (notification.read) return;
      try {
        const updated = await api.post<Notification>(
          `/notifications/${notification.id}/read`,
          undefined,
          token
        );
        setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } catch {
        // Silencioso a propósito (baja prioridad): marcar como leída no es
        // crítico, y si falla la notificación simplemente sigue apareciendo
        // como no leída; el usuario puede volver a tocarla.
      }
    },
    [token]
  );

  /** Tocar un aviso lo abre: navega a la pantalla de la que habla y lo marca
   *  leído. Antes sólo lo marcaba leído y no llevaba a ningún lado, así que
   *  había que ir a buscar a mano de qué hablaba. */
  const openNotification = useCallback(
    (notification: Notification) => {
      void markAsRead(notification);
      const href = notificationHref(notification);
      router.push(href);
      // Si el aviso lleva a la pantalla en la que ya está, `push` no vuelve a
      // pedir nada y la pantalla se queda con lo de antes (G1, U013/U014). Si
      // lleva a otra, esa carga sola al abrirse.
      if (href.split(/[?#]/)[0] === window.location.pathname) emitLiveRefresh();
    },
    [markAsRead, router]
  );

  /** Marca como leído lo que la persona tiene en pantalla, de una (2026-10-30):
   *  de a uno, una cuenta con 86 avisos dejaba la campanita en "9+" para
   *  siempre. Manda los ids que mostró (CON-10): el servidor marca sólo esos,
   *  así un aviso que llegó mientras tanto, o que no entró en la lista cargada,
   *  no se pierde sin haberse visto. Optimista: se ve
   *  leído al instante y, si el pedido falla, vuelven a no leídos sólo los
   *  que se marcaron acá (un aviso que llegó por WebSocket mientras tanto
   *  queda como está). En silencio, igual que `markAsRead`. */
  const markAllAsRead = useCallback(async () => {
    // Tope del backend: 500 ids por pedido (una cuenta normal tiene muchos menos).
    const ids = new Set(
      notifications
        .filter((n) => !n.read)
        .slice(0, 500)
        .map((n) => n.id)
    );
    if (ids.size === 0) return;
    setNotifications((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)));
    try {
      await api.post<{ marked: number }>("/notifications/read-all", { ids: [...ids] }, token);
    } catch {
      setNotifications((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: false } : n)));
    }
  }, [notifications, token]);

  const value = useMemo<Avisos>(() => {
    if (!token) return SIN_AVISOS;
    // Entre el cambio de cuenta y el efecto que vacía la lista hay un render:
    // en ese render la lista en memoria todavía es de la cuenta anterior.
    const propios = duenio === cuenta;
    const lista = propios ? notifications : [];
    return {
      activo: true,
      notifications: lista,
      loading: propios ? loading : true,
      error: propios ? error : null,
      unreadCount: lista.filter((n) => !n.read).length,
      load,
      openNotification,
      markAllAsRead,
    };
  }, [token, cuenta, duenio, notifications, loading, error, load, openNotification, markAllAsRead]);

  return <AvisosContext.Provider value={value}>{children}</AvisosContext.Provider>;
}
