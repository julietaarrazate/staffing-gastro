"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { CHAT_ROLES } from "@/lib/chat-roles";
import { Conversation } from "@/lib/types";
import { Avatar, EmptyState, ErrorBanner, Skeleton } from "@/components/ui";
import { MessageIcon } from "@/components/icons";
import { ConversationsContext, ConversationsControlContext, shiftLabel } from "./ConversationsContext";
import { useLiveRefresh } from "@/lib/live-refresh";
import { formatMessageWhen } from "@/lib/datetime";

function ConversationRowSkeleton() {
  return (
    <div className="flex gap-3 px-5 py-3">
      <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-5 w-2/5 rounded-full" />
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
  const { token } = useRequireAuth({ roles: CHAT_ROLES });
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // `silent` (recarga por un aviso o por el primer mensaje de una conversación):
  // sin esqueleto y sin pisar la lista con un error pasajero.
  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await api.get<Conversation[]>("/chats", token);
        setConversations(data);
        setError(null);
      } catch (err) {
        if (!silent) setError(getErrorMessage(err, "Error al cargar tus mensajes"));
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (G1): un mensaje nuevo (o una conversación nueva)
  // aparece en la lista sin recargar.
  useLiveRefresh(load);
  const reloadSilently = useCallback(() => void load({ silent: true }), [load]);
  const control = useMemo(
    () => ({ reload: reloadSilently, ready: !loading }),
    [reloadSilently, loading]
  );

  const isIndex = pathname === "/chats";
  // Al entrar a una conversación ya se marcó como leída del lado del backend
  // (GET /chats/{id}/messages hace mark_read) — bajamos el contador acá
  // mismo para no esperar un refetch completo de la lista.
  const activeShiftId = !isIndex ? pathname.split("/")[2] : null;

  return (
    // La dirección suave (ADR-0028, maqueta «Chats»): un cielo corto y liso,
    // sin nubes, con el título en letra normal, y la hoja con la lista, donde
    // cada chat cuelga de su turno. En el celular la conversación abierta
    // ocupa la pantalla con su propio cielo (ver `[shiftId]/page.tsx`), así
    // que el de la lista se guarda; en la compu el cielo queda y la hoja lleva
    // la lista y la conversación lado a lado.
    <div className="estilo-suave mx-auto flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] w-full flex-col md:h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pb-4 md:pt-4">
      <div
        className={`app-cielo cielo-limpio shrink-0 px-5 pb-11 pt-5 md:block md:rounded-t-[28px] md:px-6 md:pt-6 ${
          isIndex ? "" : "hidden"
        }`}
      >
        <h1 className="titulo-pantalla">Chats</h1>
      </div>

      <div
        className={`flex min-h-0 flex-1 md:-mt-7 md:overflow-hidden ${
          isIndex ? "hoja -mt-7 overflow-hidden" : "hoja-compu"
        }`}
      >
        <aside
          className={`w-full shrink-0 flex-col overflow-y-auto md:flex md:max-w-[380px] md:border-r md:border-line ${
            isIndex ? "flex" : "hidden"
          }`}
        >
          <div className="flex-1 pb-6 pt-2.5">
            {loading && (
              <div aria-hidden>
                <ConversationRowSkeleton />
                <ConversationRowSkeleton />
                <ConversationRowSkeleton />
              </div>
            )}
            {!loading && error && (
              <div className="px-5 pt-3">
                <ErrorBanner message={error} onRetry={() => load()} />
              </div>
            )}
            {!loading && conversations.length === 0 && !error && (
              <div className="px-5 pt-3">
                <EmptyState
                  icon={<MessageIcon size={28} />}
                  title="Todavía no tenés conversaciones"
                  subtitle="Apenas se asigne un turno, vas a poder chatear acá con la otra parte."
                />
              </div>
            )}

            {conversations.length > 0 && (
              <>
                <p className="px-5 pb-1 pt-3.5 text-caption font-bold text-ink-soft">
                  Coordiná los detalles de cada turno con la otra parte.
                </p>
                <ul>
                  {conversations.map((c) => {
                    const sinLeer = c.unread_count > 0;
                    const abierta = c.shift_id === activeShiftId;
                    return (
                      <li key={c.shift_id} className="chat-fila">
                        <Link
                          href={`/chats/${c.shift_id}`}
                          aria-current={abierta ? "page" : undefined}
                          onClick={() =>
                            setConversations((prev) =>
                              prev.map((p) =>
                                p.shift_id === c.shift_id ? { ...p, unread_count: 0 } : p
                              )
                            )
                          }
                          className="flex min-w-0 gap-3 px-5 py-3"
                        >
                          <Avatar
                            src={c.other_party_photo}
                            name={c.other_party_name}
                            cielo
                            className="!h-[52px] !w-[52px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-baseline justify-between gap-2">
                              <h3
                                className={`truncate text-fila text-ink ${
                                  sinLeer ? "font-extrabold" : "font-bold"
                                }`}
                              >
                                {c.other_party_name}
                              </h3>
                              <span
                                className={`shrink-0 text-xs ${
                                  sinLeer ? "font-bold text-primary-text" : "font-medium text-ink-soft"
                                }`}
                              >
                                {formatMessageWhen(c.last_message_at)}
                              </span>
                            </div>
                            <div className="mt-px flex min-w-0 items-center justify-between gap-2.5">
                              <p
                                className={`truncate text-sm ${
                                  sinLeer ? "font-semibold text-ink" : "text-ink-soft"
                                }`}
                              >
                                {c.last_message}
                              </p>
                              {sinLeer && (
                                <span className="chat-sin-leer">{c.unread_count}</span>
                              )}
                            </div>
                            {/* El chat cuelga de su turno. */}
                            <span className="chip-suave mt-2 max-w-full !px-[9px] !py-1 !text-xs !text-primary-text">
                              <span className="truncate">{shiftLabel(c.shift_title)}</span>
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </aside>

        {/* Sin conversaciones el panel derecho queda VACÍO, no con su
            placeholder. `page.tsx` dice "Elegí una conversación · Seleccioná un
            chat de la lista", que al lado de un "Todavía no tenés
            conversaciones" es una instrucción imposible: no hay lista de la cual
            elegir. Eran dos estados vacíos contradictorios uno al lado del otro
            — visible en el render a 1440px (auditoría fase I). El panel sólo
            conoce su propia ruta, así que la decisión vive acá, que es donde se
            sabe cuántas conversaciones hay. */}
        <div className={`min-w-0 flex-1 flex-col md:flex ${isIndex ? "hidden" : "flex"}`}>
          <ConversationsContext.Provider value={conversations}>
            <ConversationsControlContext.Provider value={control}>
              {isIndex && !loading && !error && conversations.length === 0 ? null : children}
            </ConversationsControlContext.Provider>
          </ConversationsContext.Provider>
        </div>
      </div>
    </div>
  );
}
