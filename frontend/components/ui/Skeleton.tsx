import { cn } from "@/lib/cn";

/** Bloque de carga (shimmer) para skeleton loaders. */
export default function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl bg-surface", className)} aria-hidden />
  );
}

/** Lista de skeletons de tarjeta para pantallas de listado en carga. */
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton de una tarjeta grande tipo turno/oportunidad. */
export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-line">
      <Skeleton className="h-40 rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
