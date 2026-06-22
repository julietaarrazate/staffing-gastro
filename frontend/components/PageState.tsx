/**
 * Bloques visuales compartidos por las pantallas de listado (feed, turnos,
 * candidatos): encabezado, estado vacío, esqueletos de carga y banner de error.
 * Unifican el lenguaje visual (tema claro, tarjetas redondeadas, chips de
 * ícono) en lugar de repetir texto gris suelto en cada página.
 */
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto mt-14 max-w-xs text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        {icon}
      </div>
      <h2 className="mt-4 font-semibold text-zinc-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
      {message}
    </div>
  );
}

export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 grid animate-pulse gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <div className="h-5 w-40 rounded-md bg-zinc-100" />
              <div className="h-3.5 w-24 rounded-md bg-zinc-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-zinc-100" />
          </div>
          <div className="mt-5 h-3.5 w-52 rounded-md bg-zinc-100" />
          <div className="mt-3 h-6 w-28 rounded-md bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}
