"use client";

// Pendientes del panel de admin: lo que espera una acción de la admin. Lo
// carga el layout de `/admin` (para los contadores del menú) y lo lee "Hoy".
// Se recarga al cambiar de sección, así que después de aprobar un DNI o
// cerrar un ticket el contador ya está al día al volver.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { LeadSummary } from "@/lib/types";

/** Tope de la consulta de tickets: si llega al tope se muestra "100+". */
export const INBOX_LIST_LIMIT = 100;

export interface AdminInbox {
  /** `null` = no se pudo saber (la sección se muestra igual, sin número). */
  identities: number | null;
  openTickets: number | null;
  newLeads: number | null;
}

const EMPTY: AdminInbox = { identities: null, openTickets: null, newLeads: null };

const AdminInboxContext = createContext<{ inbox: AdminInbox; loaded: boolean }>({
  inbox: EMPTY,
  loaded: false,
});

async function count(promise: Promise<unknown[]>): Promise<number | null> {
  try {
    return (await promise).length;
  } catch {
    return null;
  }
}

export function AdminInboxProvider({
  token,
  refreshKey,
  children,
}: {
  token: string | null;
  refreshKey: string;
  children: ReactNode;
}) {
  const [inbox, setInbox] = useState<AdminInbox>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [identities, openTickets, newLeads] = await Promise.all([
      count(api.get<unknown[]>("/identity/claims/pending", token)),
      count(
        api.get<unknown[]>(`/support/tickets?status=abierto&limit=${INBOX_LIST_LIMIT}`, token)
      ),
      api
        .get<LeadSummary>("/admin/leads/summary", token)
        .then((s) => s.counts.nuevo ?? 0)
        .catch(() => null),
    ]);
    setInbox({ identities, openTickets, newLeads });
    setLoaded(true);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <AdminInboxContext.Provider value={{ inbox, loaded }}>{children}</AdminInboxContext.Provider>
  );
}

export function useAdminInbox() {
  return useContext(AdminInboxContext);
}

/** Número para un contador: "100+" si la lista llegó al tope. */
export function formatCount(n: number, cap = INBOX_LIST_LIMIT): string {
  return n >= cap ? `${cap}+` : String(n);
}
