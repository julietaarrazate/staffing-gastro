"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Conversation } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function ChatsPage() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<Conversation[]>("/chats", token)
      .then(setConversations)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar tus mensajes")
      )
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Mensajes</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Coordiná los detalles de cada turno con la otra parte.
      </p>

      {loading && <p className="mt-8 text-zinc-500">Cargando...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {!loading && conversations.length === 0 && !error && (
        <p className="mt-8 text-zinc-500">
          Todavía no tenés conversaciones. Cuando un turno se asigne, vas a poder chatear acá.
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {conversations.map((c) => (
          <Link
            key={c.shift_id}
            href={`/chats/${c.shift_id}`}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md"
          >
            {c.other_party_photo ? (
              <img
                src={c.other_party_photo}
                alt={c.other_party_name}
                loading="lazy"
                decoding="async"
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-zinc-100"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
                {c.other_party_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-bold text-zinc-900">{c.other_party_name}</h3>
                <span className="shrink-0 text-xs text-zinc-400">
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <p className="truncate text-xs text-zinc-400">{c.shift_title}</p>
              <p className="truncate text-sm text-zinc-600">{c.last_message}</p>
            </div>
            {c.unread_count > 0 && (
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 px-1.5 text-xs font-bold text-white">
                {c.unread_count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
