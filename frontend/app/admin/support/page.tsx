"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AdminSupportTicket, TICKET_CATEGORY_LABELS, TicketStatus } from "@/lib/types";
import {
  Badge,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  SegmentedControl,
} from "@/components/ui";
import { MessageIcon } from "@/components/icons";

type Filter = TicketStatus | "todos";

export default function AdminSupportPage() {
  const { token } = useRequireAuth();
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("abierto");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<AdminSupportTicket[]>(
        `/support/tickets${filter === "todos" ? "" : `?status=${filter}`}`,
        token
      )
      .then((data) => {
        setTickets(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los tickets")))
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 md:max-w-5xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Soporte — tickets
      </h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Problemas reportados por trabajadores y comercios.
      </p>

      <div className="mt-4">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "abierto", label: "Abiertos" },
            { value: "cerrado", label: "Cerrados" },
            { value: "todos", label: "Todos" },
          ]}
        />
      </div>

      {loading && <div className="mt-5"><CardSkeletons /></div>}
      {error && <div className="mt-5"><ErrorBanner message={error} onRetry={load} /></div>}

      {!loading && !error && tickets.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<MessageIcon size={28} />}
            title="No hay tickets acá"
            subtitle="Cuando alguien reporte un problema, va a aparecer en esta lista."
          />
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="block rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:bg-surface"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold text-ink">{t.subject}</p>
                <Badge tone={t.status === "abierto" ? "secondary" : "neutral"}>
                  {t.status === "abierto" ? "Abierto" : "Cerrado"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-ink/50">
                {t.user_full_name} · {t.user_role === "worker" ? "Trabajador" : "Comercio"} ·{" "}
                {TICKET_CATEGORY_LABELS[t.category]}
              </p>
              <p className="mt-1 text-xs text-ink/40">
                {t.message_count} mensaje{t.message_count !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
