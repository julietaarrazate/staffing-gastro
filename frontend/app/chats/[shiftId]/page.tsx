"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ChatMessage } from "@/lib/types";
import { ChevronLeftIcon } from "@/components/icons";
import { formatShiftTime } from "@/lib/datetime";

export default function ConversationPage() {
  const { token, user } = useAuth();
  const params = useParams<{ shiftId: string }>();
  const shiftId = params.shiftId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<ChatMessage[]>(`/chats/${shiftId}/messages`, token);
      setMessages(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar la conversación");
    } finally {
      setLoading(false);
    }
  }, [token, shiftId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !token || sending) return;
    setSending(true);
    try {
      await api.post(`/chats/${shiftId}/messages`, { body }, token);
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
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
        {loading && <p className="text-zinc-500">Cargando...</p>}
        {error && <p className="text-red-600">{error}</p>}
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
