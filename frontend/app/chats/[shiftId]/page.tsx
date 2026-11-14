"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useWebSocket } from "@/lib/useWebSocket";
import { ChatMessage, SKILL_LABELS, Shift } from "@/lib/types";
import { CheckCheckIcon, CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { formatShiftTime } from "@/lib/datetime";
import { Avatar, ErrorBanner, MessageBubble, Skeleton } from "@/components/ui";
import { useConversation, useConversationsControl } from "../ConversationsContext";
import { LIMITES } from "@/lib/limites";

/** Eventos que llegan por el socket de la conversación: un mensaje nuevo, o
 *  el aviso de que la otra parte ya leyó lo que le mandamos (confirmación de
 *  lectura estilo WhatsApp, Julieta 2026-07-30). */
type ChatWsEvent =
  | ({ type: "message" } & ChatMessage)
  | { type: "read"; reader_user_id: string };

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
  const { token, user } = useRequireAuth();
  const params = useParams<{ shiftId: string }>();
  const shiftId = params.shiftId;
  const listed = useConversation(shiftId);
  const { reload: reloadConversations, ready: conversationsReady } = useConversationsControl();
  // U016: una conversación nueva (todavía sin mensajes) no figura en la lista
  // del layout, y el encabezado quedaba vacío. Si la lista ya cargó y no la
  // trae, se pide el turno para mostrar con quién es y de qué turno.
  const [fromShift, setFromShift] = useState<{ name: string; title: string; photo: string | null } | null>(
    null
  );
  const conversation = listed
    ? { name: listed.other_party_name, title: listed.shift_title, photo: listed.other_party_photo }
    : fromShift;

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

  const role = user?.role;
  useEffect(() => {
    if (!token || !conversationsReady || listed) return;
    let cancelled = false;
    api
      .get<Shift>(`/shifts/${shiftId}`, token)
      .then((shift) => {
        if (cancelled) return;
        // El comercio chatea con quien tomó el turno; el trabajador, con el
        // comercio. El detalle de un turno no trae el nombre del trabajador
        // (sólo el panel `/shifts/me`), así que al comercio se le dice
        // «Trabajador asignado» hasta que la lista traiga el nombre.
        setFromShift({
          name:
            role === "employer"
              ? shift.worker_name ?? "Trabajador asignado"
              : shift.company_name ?? "Comercio",
          title: shift.title ?? SKILL_LABELS[shift.position],
          photo: role === "employer" ? null : shift.company_logo_url,
        });
      })
      .catch(() => {
        // Sin el turno, el encabezado queda como estaba: no es un error.
      });
    return () => {
      cancelled = true;
    };
  }, [token, shiftId, conversationsReady, listed, role]);

  const { status: wsStatus } = useWebSocket<ChatWsEvent>(
    token ? `/chats/${shiftId}/ws` : null,
    token,
    (event) => {
      if (event.type === "read") {
        // La otra parte acaba de leer: lo que ELLA no mandó (o sea, lo que
        // mandamos nosotros) ahora está leído. No hace falta pedirle nada
        // al backend, ya sabemos qué mensajes cambian.
        setMessages((prev) =>
          prev.map((m) => (m.sender_user_id !== event.reader_user_id ? { ...m, read: true } : m))
        );
        return;
      }
      const message: ChatMessage = event;
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
    // Sin mensajes todavía, el hilo no figura en la lista del layout: con el
    // primero pasa a figurar y hay que volver a pedirla (U016).
    const firstMessage = !listed || messages.length === 0;
    try {
      await api.post(`/chats/${shiftId}/messages`, { body }, token);
      setDraft("");
      if (firstMessage) reloadConversations();
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
    <div className="flex h-full flex-1 flex-col px-4 py-4">
      {/* Encabezado: con quién y de qué turno (auditoría visual 2026-09-24).
          Antes el hilo arrancaba sin decirlo, y en md+ la única pista era el
          ítem marcado en la lista de al lado. El "volver" sólo hace falta en
          mobile: en md+ la lista ya queda fija al costado (ver layout.tsx). */}
      <div className="flex items-center gap-3">
        <Link
          href="/chats"
          aria-label="Volver a mensajes"
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/60 hover:bg-surface md:hidden"
        >
          <ChevronLeftIcon size={20} />
        </Link>
        {conversation && (
          <>
            <Avatar src={conversation.photo} name={conversation.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-ink">{conversation.name}</p>
              <p className="truncate text-caption text-ink/50">{conversation.title}</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-surface p-4 ring-1 ring-line">
        {loading && <ChatBubblesSkeleton />}
        {!loading && error && <ErrorBanner message={error} onRetry={load} />}
        {!loading && messages.length === 0 && !error && (
          <p className="text-center text-sm text-ink/40">
            Todavía no hay mensajes. ¡Escribí el primero!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_user_id === user?.id;
          return (
            <MessageBubble
              key={m.id}
              mine={mine}
              meta={
                <>
                  {formatShiftTime(m.created_at)}
                  {mine &&
                    (m.read ? (
                      <CheckCheckIcon size={13} aria-label="Visto" />
                    ) : (
                      <CheckIcon size={13} aria-label="Enviado" />
                    ))}
                </>
              }
            >
              {m.body}
            </MessageBubble>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {token && wsStatus !== "open" && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40" />
            Reconectando...
          </span>
        </div>
      )}

      {sendError && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-danger-text">
          {sendError}
          <button
            type="button"
            onClick={sendMessage}
            className="font-semibold underline decoration-danger/40 underline-offset-2 hover:opacity-80"
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
          maxLength={LIMITES.mensajeChat}
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex min-h-[44px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-sm font-semibold text-night hover:bg-primary-strong disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
