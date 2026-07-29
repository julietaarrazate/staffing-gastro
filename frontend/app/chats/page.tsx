"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Conversation } from "@/lib/types";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui";
import { MessageIcon } from "@/components/icons";

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

function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>
  );
}

export default function ChatsPage() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api
      .get<Conversation[]>("/chats", token)
      .then(setConversations)
      .catch((err) => setError(getErrorMessage(err, "Error al cargar tus mensajes")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Mensajes</h1>
      <p className="mt-1 text-sm text-ink/50">
        Coordiná los detalles de cada turno con la otra parte.
      </p>

      {loading && (
        <div className="mt-6 grid gap-3" aria-hidden>
          <ConversationRowSkeleton />
          <ConversationRowSkeleton />
          <ConversationRowSkeleton />
        </div>
      )}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && conversations.length === 0 && !error && (
        <EmptyState
          icon={<MessageIcon size={28} />}
          title="Todavía no tenés conversaciones"
          subtitle="Apenas se asigne un turno, vas a poder chatear acá con la otra parte."
        />
      )}

      <div className="mt-6 grid gap-3">
        {conversations.map((c) => (
          <Link
            key={c.shift_id}
            href={`/chats/${c.shift_id}`}
            className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:shadow-md"
          >
            {c.other_party_photo ? (
              <img
                src={c.other_party_photo}
                alt={c.other_party_name}
                loading="lazy"
                decoding="async"
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-primary-text">
                {c.other_party_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-bold text-ink">{c.other_party_name}</h3>
                <span className="shrink-0 text-xs text-ink/40">
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <p className="truncate text-xs text-ink/40">{c.shift_title}</p>
              <p className="truncate text-sm text-ink/60">{c.last_message}</p>
            </div>
            {c.unread_count > 0 && (
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
                {c.unread_count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
