"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { SupportTicketDetail, TicketSuggestion, TICKET_CATEGORY_LABELS } from "@/lib/types";
import { Badge, Button, CardSkeletons, ErrorBanner, useToast } from "@/components/ui";
import { ChevronLeftIcon, SparklesIcon } from "@/components/icons";

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
    try {
      await api.post(`/support/tickets/${params.id}/messages`, { body: reply }, token);
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

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
        <CardSkeletons />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
        <ErrorBanner message={error ?? "Ticket no encontrado"} onRetry={load} />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isClosed = ticket.status === "cerrado";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <button
        type="button"
        onClick={() => router.push(isAdmin ? "/admin/support" : "/support")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink/50 hover:text-ink"
      >
        <ChevronLeftIcon size={16} /> Volver
      </button>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
            {ticket.subject}
          </h1>
          <p className="mt-0.5 text-sm text-ink/50">{TICKET_CATEGORY_LABELS[ticket.category]}</p>
        </div>
        <Badge tone={isClosed ? "neutral" : "secondary"}>
          {isClosed ? "Cerrado" : "Abierto"}
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {ticket.messages.map((m) => {
          const isMine = m.sender_user_id === user?.id;
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-[var(--radius-card)] px-4 py-2.5 text-sm ${
                isMine
                  ? "ml-auto bg-primary/10 text-ink"
                  : "bg-white text-ink ring-1 ring-line"
              }`}
            >
              <p className="mb-0.5 text-xs font-semibold text-ink/40">
                {isMine ? "Vos" : isAdmin ? "Usuario" : "Soporte"}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
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
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escribí tu respuesta..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-[var(--radius-input)] bg-white px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={sending} disabled={!reply.trim()}>
              Enviar
            </Button>
            {!isClosed && (
              <Button type="button" variant="surface" onClick={closeTicket} loading={closing}>
                Cerrar ticket
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-5 text-center text-sm text-ink/40">
          Este ticket está cerrado. Si necesitás algo más, abrí uno nuevo.
        </p>
      )}
    </div>
  );
}
