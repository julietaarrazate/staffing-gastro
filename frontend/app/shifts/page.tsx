"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";
import ReviewBox from "@/components/ReviewBox";
import {
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from "@/components/PageState";
import {
  CheckCircleIcon,
  ClipboardIcon,
  MessageIcon,
  WalletIcon,
} from "@/components/icons";

export default function MyShiftsPage() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/me", token);
      setShifts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus turnos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function publish(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/publish`, undefined, token);
    load();
  }

  async function cancel(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/cancel`, undefined, token);
    load();
  }

  async function finish(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/finish`, undefined, token);
    load();
  }

  async function markPaid(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/mark-paid`, undefined, token);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title="Mis turnos"
        subtitle="Publicá y gestioná los turnos de tu comercio."
        action={
          <Link
            href="/shifts/new"
            className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            + Publicar turno
          </Link>
        }
      />

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && shifts.length === 0 && (
        <EmptyState
          icon={<ClipboardIcon size={26} />}
          title="Todavía no publicaste turnos"
          subtitle="Creá tu primer turno y empezá a recibir candidatos en minutos."
        />
      )}

      <div className="mt-6 grid gap-4">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift}>
            <div className="flex flex-wrap gap-2">
              {shift.worker_profile_id && shift.status !== "cancelado" && (
                <>
                  <Link
                    href={`/chats/${shift.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                  >
                    <MessageIcon size={16} /> Chat
                  </Link>
                  <Link
                    href={`/workers/${shift.worker_profile_id}`}
                    className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                  >
                    Ver trabajador
                  </Link>
                </>
              )}
              {shift.status === "borrador" && (
                <button
                  onClick={() => publish(shift.id)}
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Publicar
                </button>
              )}
              {(shift.status === "publicado" || shift.status === "buscando_personal") && (
                <Link
                  href={`/shifts/${shift.id}/candidates`}
                  className="rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Ver candidatos
                </Link>
              )}
              {!["finalizado", "pagado", "cancelado"].includes(shift.status) && (
                <button
                  onClick={() => cancel(shift.id)}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  Cancelar
                </button>
              )}
              {shift.status === "check_out" && (
                <button
                  onClick={() => finish(shift.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <CheckCircleIcon size={16} /> Cerrar turno
                </button>
              )}
              {shift.status === "finalizado" && (
                <button
                  onClick={() => markPaid(shift.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  <WalletIcon size={16} /> Marcar como pagado
                </button>
              )}
              {shift.status === "pagado" && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <CheckCircleIcon size={16} /> Pagado
                </span>
              )}
            </div>
            {(shift.status === "finalizado" || shift.status === "pagado") && (
              <div className="mt-3">
                <ReviewBox shiftId={shift.id} />
              </div>
            )}
          </ShiftCard>
        ))}
      </div>
    </div>
  );
}
