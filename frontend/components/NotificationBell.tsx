"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Notification } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Notification[]>("/notifications", token);
        if (!cancelled) setNotifications(data);
      } catch {
        // Silenciamos errores de polling: no son críticos para la UX.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

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
      // Si falla, dejamos la notificación como estaba.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
            Notificaciones
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                No tenés notificaciones.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markAsRead(n)}
                className={`block w-full border-b border-zinc-50 px-4 py-3 text-left text-sm hover:bg-zinc-50 ${
                  n.read ? "bg-white" : "bg-orange-50"
                }`}
              >
                <p className="font-medium text-zinc-800">{n.title}</p>
                <p className="mt-0.5 text-zinc-600">{n.message}</p>
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
