"use client";

// Toggle de notificaciones push en /profile (ver docs/reference/ACCESO_MODERNO.md).
// Mismo look & feel que las filas de acción de esa pantalla (icono + texto +
// estado), como componente aparte porque ese `Row` es privado del archivo.

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  detectarPlataforma,
  estaInstalada,
  type Plataforma,
} from "@/lib/instalar";
import { comoDesbloquear, estadoDePush } from "@/lib/push-estado";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { Spinner, useToast } from "@/components/ui";

const FALLA_ACTIVAR =
  "No pudimos activar las notificaciones. Probá de nuevo en un rato.";
const FALLA_DESACTIVAR =
  "No pudimos desactivar las notificaciones. Probá de nuevo en un rato.";

// Una fila suave de «Ajustes» (ADR-0028, 2026-11-20), como `FilaSuave` de
// `profile/ProfileParts`: sin ícono de color, el nombre y el estado al final.
const FILA =
  "flex min-h-[54px] w-full items-center justify-between gap-3 py-2.5 pl-4 pr-3.5 text-left";

export default function PushToggle() {
  const { token, impersonating } = useAuth();
  const hintId = useId();
  const toast = useToast();
  const [supported] = useState(() => isPushSupported());
  const [permiso, setPermiso] = useState<NotificationPermission | null>(() =>
    typeof Notification === "undefined" ? null : Notification.permission,
  );
  const [plataforma, setPlataforma] = useState<Plataforma | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [enabled, setEnabled] = useState(false);
  // Nada que chequear si el navegador no soporta push: arranca sin "cargando".
  const [checking, setChecking] = useState(supported);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlataforma(
      detectarPlataforma(navigator.userAgent, navigator.maxTouchPoints > 1),
    );
    setInstalada(estaInstalada());
    // La persona va a los ajustes del navegador a desbloquear y vuelve: se
    // vuelve a leer el permiso para no dejarle un cartel viejo.
    const releer = () => {
      if (typeof Notification !== "undefined")
        setPermiso(Notification.permission);
    };
    document.addEventListener("visibilitychange", releer);
    return () => document.removeEventListener("visibilitychange", releer);
  }, []);

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
        if (typeof Notification !== "undefined")
          setPermiso(Notification.permission);
        // Si la persona rechazó el permiso, la fila pasa a explicar cómo
        // activarlo; con cualquier otra falla, el aviso flotante.
        if (!ok && Notification.permission !== "denied")
          toast(FALLA_ACTIVAR, "error");
      }
    } catch {
      // Rechazar el permiso en el diálogo hace que `subscribe` rechace
      // (NotAllowedError): ahí la fila pasa a «Bloqueadas» y no va el aviso.
      const bloqueado =
        typeof Notification !== "undefined" &&
        Notification.permission === "denied";
      if (typeof Notification !== "undefined")
        setPermiso(Notification.permission);
      if (!bloqueado)
        toast(enabled ? FALLA_DESACTIVAR : FALLA_ACTIVAR, "error");
    } finally {
      setLoading(false);
    }
  }

  const estado = estadoDePush({
    soportado: supported,
    permiso,
    plataforma,
    instalada,
  });

  // Sin soporte y sin nada que la persona pueda hacer (o SSR): no se muestra.
  if (estado === "oculto") return null;

  // Bloqueadas en el navegador o iPhone sin la app: activar no puede funcionar
  // desde acá, así que la fila no es un botón; dice qué pasa y cómo seguir.
  if (estado === "bloqueado" || estado === "instalar") {
    const bloqueado = estado === "bloqueado";
    return (
      <div>
        <div className={FILA + " pb-1.5"}>
          <span className="flex-1 text-fila font-semibold text-ink">
            Notificaciones push
          </span>
          <span className="chip-suave !py-0.5 !text-xs text-ink-soft">
            {bloqueado ? "Bloqueadas" : "Sin instalar"}
          </span>
        </div>
        <p id={hintId} className="pb-3.5 pl-4 pr-4 text-caption text-ink-soft">
          {bloqueado ? (
            <>
              Bloqueaste las notificaciones de Oído en este navegador.{" "}
              {comoDesbloquear(plataforma, instalada)} Después volvé acá.
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">
                Instalá la app para recibir avisos.
              </strong>{" "}
              Abrí Oído en Safari (otros navegadores del iPhone no pueden
              instalarla), tocá Compartir y después «Agregar a inicio»; abrila
              desde el ícono y activá las notificaciones acá.
            </>
          )}
        </p>
      </div>
    );
  }

  const row = (
    <button
      type="button"
      onClick={toggle}
      disabled={checking || loading || locked}
      aria-describedby={locked ? hintId : undefined}
      className={FILA + " disabled:opacity-70"}
    >
      <span className="flex-1 text-fila font-semibold text-ink">
        Notificaciones push
      </span>
      {checking || loading ? (
        <Spinner size={16} className="text-ink/40" />
      ) : (
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
            (enabled
              ? "bg-success-tint text-success-text"
              : "chip-suave !py-0.5 text-ink-soft")
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
      <p
        id={hintId}
        className="-mt-1.5 pb-3.5 pl-4 pr-4 text-caption text-ink-soft"
      >
        Mientras ves la app como otra persona no se pueden cambiar las
        notificaciones de este dispositivo.
      </p>
    </div>
  );
}
