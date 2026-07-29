"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { notificationHref } from "@/lib/notification-link";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/lib/useWebSocket";
import { Notification } from "@/lib/types";
import { Skeleton } from "@/components/ui";

function NotificationRowSkeleton() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-3" aria-hidden>
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    api
      .get<Notification[]>("/notifications", token)
      .then(setNotifications)
      .catch((err) => setError(getErrorMessage(err, "No pudimos cargar tus notificaciones")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useWebSocket<Notification>(token ? "/notifications/ws" : null, token, (notification) => {
    setNotifications((prev) =>
      prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]
    );
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!token) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  /** Tocar un aviso lo abre: navega a la pantalla de la que habla y lo marca
   *  leído. Antes sólo lo marcaba leído y no llevaba a ningún lado, así que
   *  había que ir a buscar a mano de qué hablaba. */
  function openNotification(notification: Notification) {
    setOpen(false);
    void markAsRead(notification);
    router.push(notificationHref(notification));
  }

  async function markAsRead(notification: Notification) {
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
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative rounded-full p-2 text-ink/60 hover:bg-surface"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-line bg-white shadow-lg">
          <div className="border-b border-line px-4 py-2 text-sm font-semibold text-ink/70">
            Notificaciones
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <>
                <NotificationRowSkeleton />
                <NotificationRowSkeleton />
              </>
            )}
            {!loading && error && (
              <div className="px-4 py-6 text-center text-sm text-danger-text">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-1 font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-800"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loading && !error && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink/50">
                No tenés notificaciones.
              </p>
            )}
            {!loading && !error && notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`block w-full border-b border-line px-4 py-3 text-left text-sm hover:bg-surface ${
                  n.read ? "bg-white" : "bg-orange-50"
                }`}
              >
                <p className="font-medium text-ink/80">{n.title}</p>
                <p className="mt-0.5 text-ink/60">{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M12 2.25c-3.105 0-5.625 2.52-5.625 5.625v3.296c0 .654-.198 1.293-.567 1.834l-.879 1.302a1.012 1.012 0 00.84 1.568h12.462a1.012 1.012 0 00.84-1.568l-.879-1.302a3.337 3.337 0 01-.567-1.834V7.875c0-3.105-2.52-5.625-5.625-5.625zM9.75 18.75a2.25 2.25 0 104.5 0h-4.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
