"use client";

// "Hoy": portada del panel de admin. Responde "¿qué necesita mi atención?":
// pendientes con contador y acceso directo, los turnos de hoy que apuran
// (urgentes sin cubrir y ausencias) y la promesa de los 10 minutos.
// Las métricas completas están en `/admin/metricas`.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PlatformStats } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui";
import {
  AlertTriangleIcon,
  BuildingIcon,
  FlameIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/icons";
import {
  AdminHeading,
  SectionLabel,
  StatCard,
  StatCardSkeleton,
} from "@/components/admin/AdminStats";
import { formatCount, useAdminInbox } from "@/components/admin/AdminInbox";

function PendingCard({
  href,
  icon,
  count,
  label,
  doneLabel,
  action,
}: {
  href: string;
  icon: ReactNode;
  count: string | null;
  label: string;
  doneLabel: string;
  action: string;
}) {
  const pending = count !== null && count !== "0";
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:bg-surface"
    >
      <div className="flex items-center gap-2 text-ink/50">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-extrabold ${pending ? "text-ink" : "text-ink/40"}`}>
        {count ?? "—"}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink/70">
        {pending ? `${action} →` : doneLabel}
      </p>
    </Link>
  );
}

export default function AdminTodayPage() {
  const { token, user } = useAuth();
  const { inbox, loaded } = useAdminInbox();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<PlatformStats>("/admin/stats", token)
      .then(setStats)
      .catch(() => setStatsFailed(true));
  }, [token]);

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div>
      <AdminHeading
        title={firstName ? `Hola, ${firstName}` : "Hoy"}
        subtitle="Lo que espera una acción tuya, y cómo viene la promesa de los 10 minutos."
      />

      <div className="mt-6">
        <SectionLabel>Turnos de hoy</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {loaded ? (
            <>
              <PendingCard
                href="/admin/en-vivo?filtro=urgentes"
                icon={<FlameIcon size={14} />}
                label="Urgentes sin cubrir"
                count={inbox.urgentUncovered === null ? null : String(inbox.urgentUncovered)}
                doneLabel="Ninguno ahora"
                action="Ver en vivo"
              />
              <PendingCard
                href="/admin/en-vivo"
                icon={<AlertTriangleIcon size={14} />}
                label="Ausencias de hoy"
                count={inbox.noShowsToday === null ? null : String(inbox.noShowsToday)}
                doneLabel="Ninguna"
                action="Ver turnos en vivo"
              />
            </>
          ) : (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        <SectionLabel>Pendientes</SectionLabel>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {loaded ? (
            <>
              <PendingCard
                href="/admin/verificacion"
                icon={<ShieldIcon size={14} />}
                label="Identidades por verificar"
                count={inbox.identities === null ? null : formatCount(inbox.identities, Infinity)}
                doneLabel="Al día"
                action="Revisar"
              />
              <PendingCard
                href="/admin/support"
                icon={<MessageIcon size={14} />}
                label="Tickets de soporte abiertos"
                count={inbox.openTickets === null ? null : formatCount(inbox.openTickets)}
                doneLabel="Al día"
                action="Responder"
              />
              <PendingCard
                href="/admin/leads"
                icon={<BuildingIcon size={14} />}
                label="Comercios sin contactar"
                count={inbox.newLeads === null ? null : formatCount(inbox.newLeads, Infinity)}
                doneLabel="Traer un barrio"
                action="Contactar"
              />
            </>
          ) : (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          )}
        </div>
      </div>

      <div className="mt-8">
        <SectionLabel>La promesa: turno cubierto en menos de 10 minutos</SectionLabel>
        {stats ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <StatCard
                label="Tiempo promedio de cobertura"
                value={
                  stats.avg_time_to_fill_minutes === null
                    ? "—"
                    : `${stats.avg_time_to_fill_minutes.toFixed(0)} min`
                }
              />
              <StatCard
                label="Cubiertos en menos de 10 min"
                value={
                  stats.pct_filled_under_10_min === null
                    ? "—"
                    : `${stats.pct_filled_under_10_min.toFixed(0)}%`
                }
              />
            </div>
            <p className="mt-1.5 px-1 text-xs text-ink/40">
              Sobre {stats.coverage_sample_size} turno
              {stats.coverage_sample_size === 1 ? "" : "s"} cubierto
              {stats.coverage_sample_size === 1 ? "" : "s"} hasta ahora.{" "}
              <Link href="/admin/metricas" className="underline">
                Ver todas las métricas
              </Link>
            </p>
          </>
        ) : statsFailed ? (
          <Card className="mt-2 p-5">
            <p className="text-sm text-ink/60">No se pudieron cargar los números.</p>
          </Card>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3" aria-hidden>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
