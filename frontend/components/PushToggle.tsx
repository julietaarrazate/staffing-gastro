"use client";

// Toggle de notificaciones push en /profile (ver docs/reference/ACCESO_MODERNO.md).
// Mismo look & feel que las filas de acción de esa pantalla (icono + texto +
// estado), como componente aparte porque ese `Row` es privado del archivo.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { BellIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";

export default function PushToggle() {
  const { token } = useAuth();
  const [supported] = useState(() => isPushSupported());
  const [enabled, setEnabled] = useState(false);
  // Nada que chequear si el navegador no soporta push: arranca sin "cargando".
  const [checking, setChecking] = useState(supported);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getCurrentPushSubscription()
      .then((sub) => setEnabled(!!sub))
      .finally(() => setChecking(false));
  }, [supported]);

  async function toggle() {
    if (!token || loading) return;
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush(token);
        setEnabled(false);
      } else {
        const ok = await subscribeToPush(token);
        setEnabled(ok);
      }
    } finally {
      setLoading(false);
    }
  }

  // Navegador sin soporte de push (o SSR): no tiene sentido mostrar el toggle.
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={checking || loading}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface disabled:opacity-70"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-ink/50">
        <BellIcon size={18} />
      </span>
      <span className="flex-1 text-sm font-medium text-ink/80">Notificaciones push</span>
      {checking || loading ? (
        <Spinner size={16} className="text-ink/40" />
      ) : (
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
            (enabled ? "bg-green-100 text-success-text" : "bg-surface text-ink/50")
          }
        >
          {enabled ? "Activadas" : "Desactivadas"}
        </span>
      )}
    </button>
  );
}
