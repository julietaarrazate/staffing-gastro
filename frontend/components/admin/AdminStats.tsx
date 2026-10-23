// Tarjetas de números del panel de admin. Salieron de `app/admin/page.tsx`
// cuando el panel se separó en secciones (2026-10-20): las usan "Hoy" y
// "Métricas".

import type { ReactNode } from "react";
import { Card, Skeleton } from "@/components/ui";
import { formatDelta } from "@/components/admin/live";
import type { Delta } from "@/components/admin/live";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-5">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
    </Card>
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
    delta.good === true ? "text-success-text" : delta.good === false ? "text-danger-text" : "text-ink/50";
  return (
    <Card className="p-5">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className={`font-bold ${tone}`}>{formatDelta(delta)}</span>
        <span className="text-ink/50">antes {previous}</span>
      </p>
      {caption && <p className="mt-0.5 text-label text-ink/40">{caption}</p>}
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5" aria-hidden>
      <Skeleton className="h-7 w-10" />
      <Skeleton className="mt-2 h-3 w-16" />
    </Card>
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
    <Card className="p-5">
      <p className="text-2xl font-extrabold text-ink">{pct === null ? "—" : `${pct.toFixed(0)}%`}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="mt-1.5 text-label text-ink/40">{caption}</p>
    </Card>
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
    <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
      {children}
    </p>
  );
}

/** Título de cada sección del panel (una pregunta por pantalla). */
export function AdminHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-0.5 text-sm text-ink/50">{subtitle}</p>
    </div>
  );
}
