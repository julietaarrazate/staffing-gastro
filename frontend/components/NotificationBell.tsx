"use client";

import { useEffect, useRef, useState } from "react";
import { useAvisos } from "@/lib/avisos";
import { BellIcon } from "@/components/icons";
import { Sheet, Skeleton } from "@/components/ui";

function NotificationRowSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-[var(--suave-campo)] px-4 py-3" aria-hidden>
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

/** La cuenta de avisos sin leer, sobre la campanita o sobre una pestaña. */
export function CuentaAvisos({ cuantos, className = "" }: { cuantos: number; className?: string }) {
  if (cuantos <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-night ${className}`}
    >
      {cuantos > 9 ? "9+" : cuantos}
    </span>
  );
}

/**
 * La campanita: el botón y la lista de avisos. El estado (la lista, el socket,
 * marcar leído) vive en `lib/avisos.tsx`, una sola vez para toda la app; esto
 * es sólo cómo se ve.
 *
 * - `barra` (la compu): en la barra de arriba, con la lista como desplegable.
 * - `vidrio` (el celular): un botón de vidrio sobre el cielo del Inicio y del
 *   Panel, con la lista en una hoja que sube desde abajo (el cielo recorta lo
 *   que se le salga, y un desplegable de 320 px no entra en un celular chico).
 */
export default function NotificationBell({ variante = "barra" }: { variante?: "barra" | "vidrio" }) {
  const { activo, notifications, loading, error, unreadCount, load, openNotification, markAllAsRead } = useAvisos();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variante !== "barra") return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [variante]);

  if (!activo) return null;

  const marcarTodas = !loading && !error && unreadCount > 0 && (
    <button
      type="button"
      onClick={markAllAsRead}
      className="min-h-[44px] rounded-full px-3 text-xs font-semibold text-primary-text underline-offset-2 hover:underline"
    >
      Marcar todas como leídas
    </button>
  );

  const lista = (
    <>
      {loading && (
        <div className="flex flex-col gap-2 px-2">
          <NotificationRowSkeleton />
          <NotificationRowSkeleton />
        </div>
      )}
      {!loading && error && (
        <div className="px-4 py-6 text-center text-sm text-danger-text">
          <p>{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-1 font-semibold underline decoration-danger/40 underline-offset-2 hover:opacity-80"
          >
            Reintentar
          </button>
        </div>
      )}
      {!loading && !error && notifications.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">No tenés notificaciones.</p>
      )}
      {!loading && !error && notifications.length > 0 && (
        <div className="flex flex-col gap-2 px-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setOpen(false);
                openNotification(n);
              }}
              data-sin-leer={!n.read}
              className="fila-hoja aviso-fila py-3"
            >
              <p className="flex items-center font-semibold text-ink">
                {!n.read && <span className="aviso-punto" aria-hidden />}
                {n.title}
              </p>
              <p className="text-ink-soft">{n.message}</p>
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (variante === "vidrio") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Avisos"
          className="boton-vidrio relative h-11 w-11 shrink-0"
        >
          <BellIcon size={22} />
          <CuentaAvisos cuantos={unreadCount} className="absolute right-0 top-0" />
        </button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Avisos">
          {marcarTodas && <div className="flex justify-end px-2">{marcarTodas}</div>}
          {lista}
        </Sheet>
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Avisos"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface"
      >
        <BellIcon size={21} />
        <CuentaAvisos cuantos={unreadCount} className="absolute right-0.5 top-0.5" />
      </button>

      {open && (
        <div className="estilo-suave ventana-suave panel-avisos absolute right-0 z-50 mt-2 w-80 overflow-hidden">
          <div className="flex min-h-[44px] items-center justify-between gap-2 pl-4 pr-2 pt-1">
            <span className="text-sm font-extrabold text-ink">Avisos</span>
            {marcarTodas}
          </div>
          <div className="max-h-96 overflow-y-auto pb-2">{lista}</div>
        </div>
      )}
    </div>
  );
}
