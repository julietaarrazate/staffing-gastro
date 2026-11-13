"use client";

// Toggle de notificaciones push en /profile (ver docs/reference/ACCESO_MODERNO.md).
// Mismo look & feel que las filas de acción de esa pantalla (icono + texto +
// estado), como componente aparte porque ese `Row` es privado del archivo.

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { BellIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import IconChip from "@/components/ui/IconChip";

export default function PushToggle() {
  const { token, impersonating } = useAuth();
  const hintId = useId();
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

  // Las notificaciones de este dispositivo son de la cuenta que tiene la
  // sesión abierta acá. En «Ver como» el `token` es el de la persona que la
  // admin está viendo, pero el dispositivo es de la admin: prenderlas lo
  // dejaba a nombre de esa persona, y apagarlas le cancelaba las suyas. Queda
  // deshabilitado y lo dice.
  const locked = impersonating !== null;

  async function toggle() {
    if (!token || loading || locked) return;
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

  const row = (
    <button
      type="button"
      onClick={toggle}
      disabled={checking || loading || locked}
      aria-describedby={locked ? hintId : undefined}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left first:rounded-t-2xl last:rounded-b-2xl enabled:hover:bg-surface disabled:opacity-70"
    >
      <IconChip tone="cielo">
        <BellIcon size={18} />
      </IconChip>
      <span className="flex-1 text-sm font-medium text-ink/80">Notificaciones push</span>
      {checking || loading ? (
        <Spinner size={16} className="text-ink/40" />
      ) : (
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
            (enabled ? "bg-success-tint text-success-text" : "bg-surface text-ink/50")
          }
        >
          {enabled ? "Activadas" : "Desactivadas"}
        </span>
      )}
    </button>
  );

  if (!locked) return row;

  // La explicación va fuera del botón para que no se atenúe con él, alineada
  // con el texto de la fila (16 de margen + 36 del ícono + 12 de separación).
  return (
    <div>
      {row}
      <p id={hintId} className="-mt-1.5 pb-3.5 pl-16 pr-4 text-caption text-ink-soft">
        Mientras ves la app como otra persona no se pueden cambiar las notificaciones de este
        dispositivo.
      </p>
    </div>
  );
}
