"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import Link from "next/link";
import { SupportTicketDetail, TicketSuggestion, TICKET_CATEGORY_LABELS } from "@/lib/types";
import { formatShiftDate, formatShiftTime } from "@/lib/datetime";
import { Badge, Button, CardSkeletons, ErrorBanner, MessageBubble, Modal, useToast } from "@/components/ui";
import { ChevronLeftIcon, SparklesIcon } from "@/components/icons";

const ROLE_LABELS: Record<string, string> = {
  worker: "Trabajador",
  employer: "Comercio",
  admin: "Admin",
};

export default function SupportTicketPage() {
  const { token, user } = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const { keyFor, clear } = useIdempotencyKeys();
  const [reopening, setReopening] = useState(false);
  // Sugerencia interna de IA (sólo admin): resume el ticket y precarga una
  // respuesta propuesta en el campo de abajo — nunca contesta directo,
  // siempre queda a mano para revisar/editar antes de mandar.
  const [suggestion, setSuggestion] = useState<TicketSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<SupportTicketDetail>(`/support/tickets/${params.id}`, token)
      .then((data) => {
        setTicket(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el ticket")))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !reply.trim()) return;
    setSending(true);
    // U012: reintentar el mismo texto reusa la key (no duplica el mensaje).
    const attempt = `reply:${reply}`;
    try {
      await api.post(
        `/support/tickets/${params.id}/messages`,
        { body: reply },
        token,
        undefined,
        keyFor(attempt)
      );
      clear(attempt);
      setReply("");
      load();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo enviar el mensaje"), "error");
    } finally {
      setSending(false);
    }
  }

  async function requestAiSuggestion() {
    if (!token) return;
    setSuggesting(true);
    try {
      const data = await api.post<TicketSuggestion>(
        `/support/tickets/${params.id}/ai-suggestion`,
        undefined,
        token
      );
      setSuggestion(data);
      setReply(data.suggested_reply);
    } catch (err) {
      toast(getErrorMessage(err, "No pudimos generar una sugerencia. Respondé a mano."), "error");
    } finally {
      setSuggesting(false);
    }
  }

  async function closeTicket() {
    if (!token) return;
    setClosing(true);
    setConfirmClose(false);
    try {
      await api.post(`/support/tickets/${params.id}/close`, undefined, token);
      toast("Ticket cerrado");
      load();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo cerrar el ticket"), "error");
    } finally {
      setClosing(false);
    }
  }

  async function reopenTicket() {
    if (!token) return;
    setReopening(true);
    try {
      await api.post(`/support/tickets/${params.id}/reopen`, undefined, token);
      toast("Ticket reabierto");
      load();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo reabrir el ticket"), "error");
    } finally {
      setReopening(false);
    }
  }

  if (loading) {
    return (
      <div className="app-container-reading px-4 pb-10 pt-6">
        <CardSkeletons />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="app-container-reading px-4 pb-10 pt-6">
        <ErrorBanner message={error ?? "Ticket no encontrado"} onRetry={load} />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isClosed = ticket.status === "cerrado";

  return (
    <div className="app-container-reading px-4 pb-10 pt-6">
      <button
        type="button"
        onClick={() => router.push(isAdmin ? "/admin/support" : "/support")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink/50 hover:text-ink"
      >
        <ChevronLeftIcon size={16} /> Volver
      </button>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-0.5 text-sm text-ink/50">{TICKET_CATEGORY_LABELS[ticket.category]}</p>
        </div>
        <Badge tone={isClosed ? "neutral" : "secondary"}>
          {isClosed ? "Cerrado" : "Abierto"}
        </Badge>
      </div>

      {isAdmin && ticket.opened_by && (
        <p className="mt-3 text-sm text-ink/60">
          Abierto por{" "}
          <Link
            href={`/admin/personas/${ticket.opened_by.user_id}`}
            className="font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            {ticket.opened_by.full_name}
          </Link>{" "}
          ({ROLE_LABELS[ticket.opened_by.role] ?? ticket.opened_by.role})
        </p>
      )}

      {(ticket.references?.shift || ticket.references?.company) && (
        <div
          data-testid="ticket-reference"
          className="mt-3 rounded-[var(--radius-card)] bg-surface px-4 py-3 text-sm ring-1 ring-line"
        >
          {ticket.references.shift && (
            <p className="text-ink/70">
              <span className="text-ink/50">Turno: </span>
              {isAdmin ? (
                <Link
                  href={`/turno/${ticket.references.shift.id}`}
                  className="font-semibold text-primary-text underline-offset-2 hover:underline"
                >
                  {ticket.references.shift.title}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{ticket.references.shift.title}</span>
              )}{" "}
              · {formatShiftDate(ticket.references.shift.start_at)}{" "}
              {formatShiftTime(ticket.references.shift.start_at)}
              {ticket.references.shift.company_name
                ? ` · ${ticket.references.shift.company_name}`
                : ""}
            </p>
          )}
          {ticket.references.company && !ticket.references.shift && (
            <p className="text-ink/70">
              <span className="text-ink/50">Comercio: </span>
              {isAdmin && ticket.references.company.user_id ? (
                <Link
                  href={`/admin/personas/${ticket.references.company.user_id}`}
                  className="font-semibold text-primary-text underline-offset-2 hover:underline"
                >
                  {ticket.references.company.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{ticket.references.company.name}</span>
              )}
            </p>
          )}
          {isAdmin && ticket.references.shift && ticket.references.company?.user_id && (
            <p className="mt-1 text-ink/70">
              <span className="text-ink/50">Ficha del comercio: </span>
              <Link
                href={`/admin/personas/${ticket.references.company.user_id}`}
                className="font-semibold text-primary-text underline-offset-2 hover:underline"
              >
                {ticket.references.company.name}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {ticket.messages.map((m) => {
          const isMine = m.sender_user_id === user?.id;
          return (
            <MessageBubble key={m.id} mine={isMine} author={isMine ? "Vos" : isAdmin ? "Usuario" : "Soporte"}>
              {m.body}
            </MessageBubble>
          );
        })}
      </div>

      {!isClosed || isAdmin ? (
        <form onSubmit={sendReply} className="mt-5 flex flex-col gap-2.5">
          {isAdmin && (
            <div className="rounded-[var(--radius-card)] bg-surface p-3.5 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink/70">
                  <SparklesIcon size={16} className="text-primary" /> Sugerencia de IA
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="surface"
                  loading={suggesting}
                  onClick={requestAiSuggestion}
                >
                  {suggestion ? "Regenerar" : "Sugerir"}
                </Button>
              </div>
              {suggestion && (
                <p className="mt-2 text-sm text-ink/60">{suggestion.summary}</p>
              )}
              <p className="mt-1.5 text-xs text-ink/40">
                Sólo precarga la respuesta de abajo — revisala antes de mandar, nunca le contesta
                directo al usuario.
              </p>
            </div>
          )}
          {isAdmin && isClosed && (
            <p className="text-sm text-ink/60">
              Este ticket está cerrado. Si le escribís, se reabre y la persona puede contestar.
            </p>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escribí tu respuesta..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-[var(--radius-input)] bg-card px-4 py-3 text-body text-ink outline-none ring-1 ring-line transition"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={sending} disabled={!reply.trim()}>
              Enviar
            </Button>
            {!isClosed && (
              <Button type="button" variant="surface" onClick={() => setConfirmClose(true)} loading={closing}>
                Cerrar ticket
              </Button>
            )}
            {isClosed && isAdmin && (
              <Button type="button" variant="surface" onClick={reopenTicket} loading={reopening}>
                Reabrir
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-5 text-center text-sm text-ink/40">
          Este ticket está cerrado. Si necesitás algo más, abrí uno nuevo.
        </p>
      )}
      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="¿Cerrar este ticket?">
        <p className="text-sm text-ink/60">
          {isAdmin
            ? "La persona ya no va a poder contestar. Podés reabrirlo cuando quieras."
            : "Ya no vas a poder escribir en este ticket. Si necesitás algo más, vas a tener que abrir uno nuevo."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmClose(false)}>
            Volver
          </Button>
          <Button size="sm" onClick={closeTicket}>
            Sí, cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
