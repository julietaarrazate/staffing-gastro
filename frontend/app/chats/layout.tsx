"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
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

/**
 * Panel de conversaciones (patrón inbox — Gmail/WhatsApp Web/Slack, pedido
 * de Julieta al comparar con Pasito): en `md+` queda fijo a la izquierda,
 * siempre visible, mientras `children` (la conversación abierta o el
 * placeholder de `/chats`) ocupa el resto del ancho. En mobile se comporta
 * como antes (páginas separadas, navegación completa): este panel sólo se ve
 * en `/chats` y `children` sólo se ve en `/chats/{shiftId}`.
 */
export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const { token } = useRequireAuth();
  const pathname = usePathname();
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

  const isIndex = pathname === "/chats";
  // Al entrar a una conversación ya se marcó como leída del lado del backend
  // (GET /chats/{id}/messages hace mark_read) — bajamos el contador acá
  // mismo para no esperar un refetch completo de la lista.
  const activeShiftId = !isIndex ? pathname.split("/")[2] : null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-5rem)] max-w-6xl overflow-hidden md:h-[calc(100dvh-4rem)]">
      <aside
        className={`w-full shrink-0 flex-col overflow-y-auto border-r border-line bg-white md:flex md:max-w-[380px] ${
          isIndex ? "flex" : "hidden"
        }`}
      >
        <div className="px-4 pb-2 pt-6">
          <h1 className="font-display text-2xl font-semibold">Mensajes</h1>
          <p className="mt-1 text-sm text-ink/50">
            Coordiná los detalles de cada turno con la otra parte.
          </p>
        </div>

        <div className="flex-1 space-y-3 px-4 pb-6">
          {loading && (
            <div className="grid gap-3" aria-hidden>
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

          <div className="grid gap-3">
            {conversations.map((c) => (
              <Link
                key={c.shift_id}
                href={`/chats/${c.shift_id}`}
                onClick={() =>
                  setConversations((prev) =>
                    prev.map((p) => (p.shift_id === c.shift_id ? { ...p, unread_count: 0 } : p))
                  )
                }
                className={`flex items-center gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-soft)] ring-1 transition hover:shadow-md ${
                  c.shift_id === activeShiftId
                    ? "bg-orange-50 ring-primary/40"
                    : "bg-white ring-line"
                }`}
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
                  <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-ink">
                    {c.unread_count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <div className={`min-w-0 flex-1 flex-col md:flex ${isIndex ? "hidden" : "flex"}`}>
        {children}
      </div>
    </div>
  );
}
