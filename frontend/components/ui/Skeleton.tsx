import { cn } from "@/lib/cn";

/** Bloque de carga (shimmer) para skeleton loaders. */
export default function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl bg-zinc-100", className)} aria-hidden />
  );
}

/** Skeleton de una tarjeta grande tipo turno/oportunidad. */
export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-zinc-100">
      <Skeleton className="h-40 rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
