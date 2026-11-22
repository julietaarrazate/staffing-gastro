"use client";

// Tarjetas de números del panel de admin. Salieron de `app/admin/page.tsx`
// cuando el panel se separó en secciones (2026-10-20): las usan "Hoy" y
// "Métricas".

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { useTituloAdmin } from "@/components/admin/PantallaAdmin";
import { formatDelta } from "@/components/admin/live";
import type { Delta } from "@/components/admin/live";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tarjeta-suave min-w-0 p-5">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="break-words text-xs font-medium text-ink-soft">{label}</p>
    </div>
  );
}

/**
 * Número del período con la comparación contra el anterior ("Métricas" con
 * período). La flecha va en verde si el cambio es bueno para el negocio y en
 * rojo si es malo (en el tiempo hasta cubrir, bajar es bueno), y en gris si
 * no cambió o no hay con qué comparar.
 */
export function DeltaStatCard({
  label,
  value,
  previous,
  delta,
  caption,
}: {
  label: string;
  value: string;
  previous: string;
  delta: Delta;
  caption?: string;
}) {
  const tone =
    delta.good === true ? "text-success-text" : delta.good === false ? "text-danger-text" : "text-ink-soft";
  return (
    <div className="tarjeta-suave min-w-0 p-5">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="break-words text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className={`font-bold ${tone}`}>{formatDelta(delta)}</span>
        <span className="text-ink-soft">antes {previous}</span>
      </p>
      {caption && <p className="mt-0.5 text-label text-ink-soft">{caption}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="tarjeta-suave min-w-0 p-5" aria-hidden>
      <Skeleton className="h-7 w-10" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

export function RateCard({
  label,
  pct,
  caption,
}: {
  label: string;
  pct: number | null;
  caption: string;
}) {
  return (
    <div className="tarjeta-suave min-w-0 p-5">
      <p className="text-2xl font-extrabold text-ink">{pct === null ? "—" : `${pct.toFixed(0)}%`}</p>
      <p className="break-words text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1.5 text-label text-ink-soft">{caption}</p>
    </div>
  );
}

/** "Sobre 3 turnos publicados" / "Sobre 1 turno publicado" — evita el plural
 * mal puesto sobre una muestra chica, que en el panel de admin es común. */
export function sampleCaption(n: number, singular: string, plural: string): string {
  return `Sobre ${n} ${n === 1 ? singular : plural}`;
}

/** Rótulo de un bloque dentro de una sección del panel. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-sm font-bold text-ink-soft">
      {children}
    </p>
  );
}

/** Título de cada sección del panel (una pregunta por pantalla). No dibuja
 * nada acá: va en el cielo de la cáscara (`PantallaAdmin`). */
export function AdminHeading({
  title,
  subtitle,
  volver,
}: {
  title: string;
  subtitle?: string;
  volver?: { href: string; label: string };
}) {
  useTituloAdmin({ title, subtitle, volver });
  return null;
}
