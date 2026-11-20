"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useWebSocket } from "@/lib/useWebSocket";
import { ChatMessage, SKILL_LABELS, Shift } from "@/lib/types";
import { CheckCheckIcon, CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { formatShiftTime } from "@/lib/datetime";
import { Avatar, ErrorBanner, MessageBubble, Skeleton } from "@/components/ui";
import { shiftLabel, useConversation, useConversationsControl } from "../ConversationsContext";
import { LIMITES } from "@/lib/limites";
import { useIdempotencyKeys } from "@/lib/idempotency";

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
    ? { name: listed.other_party_name, title: shiftLabel(listed.shift_title), photo: listed.other_party_photo }
    : fromShift;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { keyFor, clear } = useIdempotencyKeys();
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
      setNotFound(false);
    } catch (err) {
      setNotFound(isNotFound(err));
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
    // U012: un reintento del MISMO texto reusa la key (el backend no duplica
    // el mensaje); si el texto cambió es otro pedido y lleva key nueva.
    const attempt = `${shiftId}:${body}`;
    try {
      await api.post(`/chats/${shiftId}/messages`, { body }, token, undefined, keyFor(attempt));
      clear(attempt);
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

  // U099: si la conversación no existe para mí (turno ajeno, inexistente o sin
  // persona asignada: el backend responde 404 sin distinguir), no hay a quién
  // escribirle. Un error de red transitorio NO oculta el formulario.
  const unavailable = !loading && notFound && messages.length === 0;

  function send(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Encabezado: con quién y de qué turno (auditoría visual 2026-09-24).
          En el celular es el cielo corto de la pantalla, con la vuelta en un
          botón de vidrio; en la compu la lista ya queda fija al costado (ver
          layout.tsx), así que va sobre la hoja, sin vuelta y con una raya
          debajo (`.cielo-celular` apaga el cielo desde `md`). */}
      <div className="app-cielo cielo-limpio cielo-celular flex shrink-0 items-center gap-3 px-4 pb-10 pt-3 md:border-b md:border-line md:px-5 md:py-3.5">
        <Link
          href="/chats"
          aria-label="Volver a mensajes"
          className="boton-vidrio h-11 w-11 shrink-0"
        >
          <ChevronLeftIcon size={20} />
        </Link>
        {conversation && (
          <>
            <Avatar src={conversation.photo} name={conversation.name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-h3 font-extrabold leading-tight">
                {conversation.name}
              </p>
              <p className="mt-0.5 truncate text-caption font-semibold">{conversation.title}</p>
            </div>
          </>
        )}
      </div>

      {/* La hoja sube sobre el cielo (en la compu ya es la del layout). */}
      <div className="hoja-celular -mt-7 flex min-h-0 flex-1 flex-col md:mt-0">
        <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-2 pt-5 md:px-5">
          {loading && <ChatBubblesSkeleton />}
          {!loading && error && <ErrorBanner message={error} onRetry={load} />}
          {!loading && messages.length === 0 && !error && (
            <p className="pt-2 text-center text-sm text-ink-soft">
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
          <div className="mt-2 flex justify-center px-4">
            <span className="chip-suave !text-xs !text-ink-soft">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft" />
              Reconectando...
            </span>
          </div>
        )}

        {sendError && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 text-xs font-medium text-danger-text md:px-5">
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

        {/* Donde se escribe: el campo con relleno y «Enviar», la única acción
            (el único ámbar de la pantalla). */}
        {!unavailable && (
          <form onSubmit={send} className="flex gap-2 px-4 pb-3 pt-2.5 md:px-5 md:pb-4">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribí un mensaje..."
              aria-label="Mensaje"
              maxLength={LIMITES.mensajeChat}
              className="campo h-12 min-w-0 flex-1 px-4 text-body text-ink"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="boton-relieve flex h-12 shrink-0 items-center justify-center bg-primary px-5 text-sm font-bold text-night hover:bg-primary-strong disabled:bg-surface disabled:text-ink-mute"
            >
              Enviar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
