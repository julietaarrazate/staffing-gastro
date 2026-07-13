"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";
import ReviewBox from "@/components/ReviewBox";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
import { Button, CardSkeletons, EmptyState, ErrorBanner, useToast } from "@/components/ui";
import {
  BoltIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  MessageIcon,
  WalletIcon,
} from "@/components/icons";

const ACTIVE = ["asignado", "confirmado", "en_camino", "check_in", "trabajando", "check_out"];
const SEARCHING = ["publicado", "buscando_personal"];
const DONE = ["finalizado", "pagado"];

function Kpi({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-zinc-100">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <span className="mt-0.5 text-2xl font-extrabold leading-none text-zinc-900">{value}</span>
      <span className="text-[11px] font-medium text-zinc-500">{label}</span>
    </div>
  );
}

type Action = "publish" | "cancel" | "finish" | "markPaid";

const ACTION_PATH: Record<Action, string> = {
  publish: "publish",
  cancel: "cancel",
  finish: "finish",
  markPaid: "mark-paid",
};

export default function MyShiftsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/me", token);
      setShifts(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar tus turnos"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  // Helper único para las acciones de estado del turno: registra qué tarjeta
  // está ocupada (para loading/disabled), atrapa errores del POST (antes se
  // dejaban sin manejar) y refresca la lista al terminar.
  async function run(id: string, action: Action) {
    if (!token) return;
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      await api.post(`/shifts/${id}/${ACTION_PATH[action]}`, undefined, token);
      await load();
    } catch (err) {
      if (action === "publish" && isPlanLimitError(err)) {
        setPlanLimitMessage(getErrorMessage(err));
      } else {
        toast(getErrorMessage(err, "No se pudo completar la acción"), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  const kpis = {
    active: shifts.filter((s) => ACTIVE.includes(s.status)).length,
    searching: shifts.filter((s) => SEARCHING.includes(s.status)).length,
    done: shifts.filter((s) => DONE.includes(s.status)).length,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Panel</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Gestioná los turnos de tu comercio.</p>
        </div>
        <Link
          href="/shifts/new"
          className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,107,0,0.3)] transition active:scale-95"
        >
          + Publicar
        </Link>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Kpi icon={<BoltIcon size={18} />} value={kpis.active} label="Activos" tone="bg-orange-50 text-primary" />
        <Kpi icon={<ClockIcon size={18} />} value={kpis.searching} label="Buscando" tone="bg-blue-50 text-blue-600" />
        <Kpi icon={<CheckCircleIcon size={18} />} value={kpis.done} label="Finalizados" tone="bg-green-50 text-secondary" />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}
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
                <Button
                  size="sm"
                  onClick={() => run(shift.id, "publish")}
                  loading={busy === `${shift.id}:publish`}
                  disabled={busy !== null}
                >
                  Publicar
                </Button>
              )}
              {(shift.status === "publicado" || shift.status === "buscando_personal") && (
                <Link
                  href={`/shifts/${shift.id}/candidates`}
                  className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95"
                >
                  Ver postulantes
                </Link>
              )}
              {!["finalizado", "pagado", "cancelado"].includes(shift.status) && (
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => run(shift.id, "cancel")}
                  loading={busy === `${shift.id}:cancel`}
                  disabled={busy !== null}
                >
                  Cancelar
                </Button>
              )}
              {shift.status === "check_out" && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<CheckCircleIcon size={16} />}
                  onClick={() => run(shift.id, "finish")}
                  loading={busy === `${shift.id}:finish`}
                  disabled={busy !== null}
                >
                  Cerrar turno
                </Button>
              )}
              {shift.status === "finalizado" && (
                <Button
                  size="sm"
                  leftIcon={<WalletIcon size={16} />}
                  onClick={() => run(shift.id, "markPaid")}
                  loading={busy === `${shift.id}:markPaid`}
                  disabled={busy !== null}
                >
                  Marcar como pagado
                </Button>
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

      <PlanLimitModal
        open={planLimitMessage !== null}
        message={planLimitMessage}
        onClose={() => setPlanLimitMessage(null)}
      />
    </div>
  );
}
