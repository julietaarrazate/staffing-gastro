"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/lib/useWebSocket";
import { ChatMessage } from "@/lib/types";
import { ChevronLeftIcon } from "@/components/icons";
import { formatShiftTime } from "@/lib/datetime";
import { ErrorBanner, Skeleton } from "@/components/ui";

function ChatBubblesSkeleton() {
  const widths = ["w-1/2", "w-2/3", "w-1/3", "w-3/5"];
  return (
    <div className="space-y-2" aria-hidden>
      {widths.map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <Skeleton className={`h-9 ${w} max-w-[75%] rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

export default function ConversationPage() {
  const { token, user } = useAuth();
  const params = useParams<{ shiftId: string }>();
  const shiftId = params.shiftId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // La primera apertura del socket coincide con la carga inicial (load() ya
  // trajo todo); a partir de la segunda, cada apertura es una reconexión y
  // puede haber un gap de mensajes perdidos mientras estuvo caído.
  const hasOpenedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<ChatMessage[]>(`/chats/${shiftId}/messages`, token);
      setMessages(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar la conversación"));
    } finally {
      setLoading(false);
    }
  }, [token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  const { status: wsStatus } = useWebSocket<ChatMessage>(
    token ? `/chats/${shiftId}/ws` : null,
    token,
    (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    },
    useCallback(() => {
      if (!hasOpenedOnce.current) {
        hasOpenedOnce.current = true;
        return;
      }
      // Reconexión: volvemos a cargar por HTTP para no perder mensajes del gap.
      load();
    }, [load])
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !token || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/chats/${shiftId}/messages`, { body }, token);
      setDraft("");
      await load();
    } catch (err) {
      // No borramos el draft: el usuario no debería tener que reescribir el
      // mensaje si el envío falló.
      setSendError(getErrorMessage(err, "No se pudo enviar el mensaje"));
    } finally {
      setSending(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col px-4 py-4">
      <Link
        href="/chats"
        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline"
      >
        <ChevronLeftIcon size={16} /> Volver a mensajes
      </Link>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
        {loading && <ChatBubblesSkeleton />}
        {!loading && error && <ErrorBanner message={error} onRetry={load} />}
        {!loading && messages.length === 0 && !error && (
          <p className="text-center text-sm text-zinc-400">
            Todavía no hay mensajes. ¡Escribí el primero!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_user_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-orange-600 text-white"
                    : "rounded-bl-sm bg-white text-zinc-800 ring-1 ring-zinc-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-orange-100" : "text-zinc-400"}`}>
                  {formatShiftTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {token && wsStatus !== "open" && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-ink/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40" />
            Reconectando...
          </span>
        </div>
      )}

      {sendError && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-red-600">
          {sendError}
          <button
            type="button"
            onClick={sendMessage}
            className="font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-800"
          >
            Reintentar
          </button>
        </p>
      )}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribí un mensaje..."
          className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
