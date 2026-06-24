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
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
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
    <div className="mx-auto mt-14 max-w-xs rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-100">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-500">
        {icon}
      </div>
      <h2 className="mt-4 font-bold text-zinc-900">{title}</h2>
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
          className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100"
        >
          <div className="h-24 bg-zinc-100" />
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="h-5 w-20 rounded-full bg-zinc-100" />
              <div className="h-5 w-16 rounded-md bg-zinc-100" />
            </div>
            <div className="mt-4 h-3.5 w-52 rounded-md bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
