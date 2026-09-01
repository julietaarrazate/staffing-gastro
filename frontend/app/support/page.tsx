"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  SupportTicket,
  TICKET_CATEGORY_LABELS,
  TicketCategory,
} from "@/lib/types";
import {
  Badge,
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  Modal,
  TextField,
  useToast,
} from "@/components/ui";
import { MessageIcon, PlusIcon } from "@/components/icons";

const CATEGORIES: TicketCategory[] = ["general", "cv_documentos", "pagos", "cuenta", "otro"];

export default function SupportPage() {
  const { token } = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<SupportTicket[]>("/support/tickets/mine", token)
      .then((data) => {
        setTickets(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar tus tickets")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setCategory("general");
    setSubject("");
    setBody("");
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const ticket = await api.post<SupportTicket>(
        "/support/tickets",
        { category, subject, body },
        token
      );
      setShowNew(false);
      resetForm();
      router.push(`/support/${ticket.id}`);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo abrir el ticket"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 md:max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Soporte</h1>
          <p className="mt-0.5 text-sm text-ink/50">
            ¿Algún problema con la app? Contanos y te respondemos por acá.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <PlusIcon size={16} /> Nuevo
        </Button>
      </div>

      {loading && <div className="mt-5"><CardSkeletons /></div>}
      {error && <div className="mt-5"><ErrorBanner message={error} onRetry={load} /></div>}

      {!loading && !error && tickets.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<MessageIcon size={28} />}
            title="Todavía no abriste ningún ticket"
            subtitle="Si tenés un problema con la app, contanos acá y te respondemos."
            primaryAction={{ label: "Abrir un ticket", onClick: () => setShowNew(true) }}
          />
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="mt-5 space-y-2.5">
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
              <p className="mt-1 text-sm text-ink/50">{TICKET_CATEGORY_LABELS[t.category]}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo ticket de soporte">
        <form onSubmit={submitTicket} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Categoría</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="min-h-[48px] w-full rounded-[var(--radius-input)] bg-card px-4 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="Asunto"
            value={subject}
            onChange={setSubject}
            placeholder="Resumen corto de tu problema"
            maxLength={200}
            required
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Contanos qué pasa</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describí el problema con el mayor detalle posible"
              maxLength={2000}
              required
              rows={5}
              className="w-full rounded-[var(--radius-input)] bg-card px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <Button type="button" variant="surface" fullWidth onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={submitting}>
              Enviar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
