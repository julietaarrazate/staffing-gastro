"use client";

// Ficha de una persona en el panel de admin: cuenta, perfil según el rol
// (reputación del trabajador o datos del comercio), turnos y tickets
// recientes, y las acciones de moderación (antes estaban en cada tarjeta de
// la lista). Paso 2 del panel por secciones (2026-10-20).

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABELS as SHIFT_STATUS_LABELS, SKILL_LABELS } from "@/lib/types";
import type { AdminUserDetail, ShiftStatus, WorkerSkill } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { formatShiftDate } from "@/lib/datetime";
import { formatPunctuality, formatRating, levelLabel } from "@/lib/reputation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  Modal,
} from "@/components/ui";
import { CheckCircleIcon, ChevronLeftIcon, EyeIcon, UsersIcon } from "@/components/icons";
import { SectionLabel } from "@/components/admin/AdminStats";
import { ROLE_LABELS, STATUS_LABELS, TICKET_STATUS_LABELS } from "@/components/admin/people";

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink/50">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function skillLabel(skill: string): string {
  return SKILL_LABELS[skill as WorkerSkill] ?? skill;
}

export default function AdminPersonPage() {
  const { user: me, token, impersonate } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Suspender y hacer admin piden confirmación: con la ficha a mano, un toque
  // de más le corta el acceso a alguien o le da el panel entero.
  const [confirm, setConfirm] = useState<"suspend" | "promote" | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    api
      .get<AdminUserDetail>(`/admin/users/${params.id}`, token)
      .then(setDetail)
      .catch((err) => {
        if (isNotFound(err)) setNotFound(true);
        else setError(getErrorMessage(err, "No se pudo cargar la ficha"));
      });
  }, [token, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string) {
    if (!token || !detail) return;
    setBusy(action);
    try {
      await api.post(`/admin/users/${detail.user.id}/${action}`, undefined, token);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setBusy(null);
    }
  }

  async function handleImpersonate() {
    if (!detail) return;
    setBusy("impersonate");
    try {
      await impersonate(detail.user.id);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : getErrorMessage(err, "No se pudo entrar como esta persona")
      );
      setBusy(null);
    }
  }

  const back = (
    <Link
      href="/admin/personas"
      className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60 transition hover:text-ink"
    >
      <ChevronLeftIcon size={16} /> Personas
    </Link>
  );

  if (notFound) {
    return (
      <div>
        {back}
        <div className="mt-5">
          <EmptyState
            icon={<UsersIcon size={28} />}
            title="No encontramos a esta persona"
            subtitle="Puede que el enlace esté mal o que la cuenta ya no exista."
          />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        {back}
        {error ? (
          <div className="mt-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : (
          <div className="mt-5">
            <CardSkeletons />
          </div>
        )}
      </div>
    );
  }

  const u = detail.user;
  const isMe = u.id === me?.id;

  return (
    <div>
      {back}

      <div className="mt-3 flex items-start gap-4">
        <Avatar src={u.photo_url} name={u.full_name} size="lg" />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-h1 font-semibold tracking-tight text-ink">
            <span className="truncate">{u.full_name}</span>
            {u.is_verified && <CheckCircleIcon size={20} className="shrink-0 text-success-text" />}
          </h1>
          <p className="truncate text-sm text-ink/50">{u.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{ROLE_LABELS[u.role] ?? u.role}</Badge>
            <Badge tone={u.status === "active" ? "secondary" : "danger"}>
              {STATUS_LABELS[u.status] ?? u.status}
            </Badge>
            {u.created_at && (
              <Badge tone="neutral">Desde {formatShiftDate(u.created_at)}</Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {u.role !== "admin" && (
          <Button
            size="sm"
            variant="surface"
            leftIcon={<EyeIcon size={14} />}
            disabled={busy !== null}
            loading={busy === "impersonate"}
            onClick={handleImpersonate}
          >
            Ver como
          </Button>
        )}
        {!u.is_verified && (
          <Button
            size="sm"
            variant="surface"
            disabled={busy !== null}
            loading={busy === "verify"}
            onClick={() => act("verify")}
          >
            Verificar
          </Button>
        )}
        {u.status === "active" ? (
          <Button
            size="sm"
            variant="danger"
            disabled={busy !== null || isMe}
            loading={busy === "suspend"}
            onClick={() => setConfirm("suspend")}
          >
            {isMe ? "Sos vos" : "Suspender"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            loading={busy === "activate"}
            onClick={() => act("activate")}
          >
            Reactivar
          </Button>
        )}
        {u.role !== "admin" && (
          <Button
            size="sm"
            variant="surface"
            disabled={busy !== null}
            loading={busy === "promote"}
            onClick={() => setConfirm("promote")}
          >
            Hacer admin
          </Button>
        )}
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "suspend" ? `¿Suspender a ${u.full_name}?` : `¿Hacer admin a ${u.full_name}?`}
      >
        <p className="text-sm text-ink/60">
          {confirm === "suspend"
            ? "No va a poder entrar a la app hasta que la reactives."
            : "Va a ver y manejar todo el panel de administración, como vos."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirm(null)}>
            Volver
          </Button>
          <Button
            variant={confirm === "suspend" ? "danger" : "dark"}
            size="sm"
            onClick={() => {
              const action = confirm;
              setConfirm(null);
              if (action) void act(action);
            }}
          >
            {confirm === "suspend" ? "Sí, suspender" : "Sí, hacer admin"}
          </Button>
        </div>
      </Modal>

      {detail.worker && (
        <div className="mt-8">
          <SectionLabel>Como trabajador</SectionLabel>
          <Card className="mt-2 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Turnos completados" value={detail.worker.events_completed} />
              <Fact label="Calificación" value={formatRating(detail.worker.rating)} />
              <Fact label="Puntualidad" value={formatPunctuality(detail.worker.punctuality_rate)} />
              <Fact label="Nivel" value={levelLabel(detail.worker.level)} />
              <Fact label="Cancelaciones" value={detail.worker.cancellations} />
              <Fact label="No se presentó" value={detail.worker.no_shows} />
              <Fact label="Experiencia" value={`${detail.worker.years_experience} años`} />
              <Fact label="Disponible" value={detail.worker.is_available ? "Sí" : "No"} />
            </div>
            <p className="mt-4 text-sm text-ink/60">
              {detail.worker.skills.map(skillLabel).join(" · ") || "Sin puestos cargados"}
              {detail.worker.city ? ` — ${detail.worker.city}` : ""}
            </p>
          </Card>
        </div>
      )}

      {detail.company && (
        <div className="mt-8">
          <SectionLabel>Como comercio</SectionLabel>
          <Card className="mt-2 p-5">
            <p className="font-semibold text-ink">{detail.company.name}</p>
            <p className="text-sm text-ink/50">
              {[detail.company.address, detail.company.city].filter(Boolean).join(", ") ||
                "Sin dirección cargada"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Turnos publicados" value={detail.company.events_published} />
              <Fact label="Calificación" value={formatRating(detail.company.rating)} />
              <Fact
                label="Paga a tiempo"
                value={formatPunctuality(detail.company.on_time_payment_rate)}
              />
              <Fact label="Cancelaciones tardías" value={detail.company.late_cancellations} />
            </div>
          </Card>
        </div>
      )}

      {(detail.worker || detail.company) && (
        <div className="mt-8">
          <SectionLabel>Turnos recientes</SectionLabel>
          {detail.recent_shifts.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-ink/50">Todavía no tiene turnos.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-card ring-1 ring-line">
              {detail.recent_shifts.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{s.title || skillLabel(s.position)}</p>
                    <p className="text-xs text-ink/50">
                      {formatShiftDate(s.start_at)} · {formatArs(s.pay_amount)}
                    </p>
                  </div>
                  <Badge tone="neutral">
                    {SHIFT_STATUS_LABELS[s.status as ShiftStatus] ?? s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8">
        <SectionLabel>Soporte</SectionLabel>
        {detail.tickets.length === 0 ? (
          <p className="mt-2 px-1 text-sm text-ink/50">No abrió tickets.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-card ring-1 ring-line">
            {detail.tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/support/${t.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface"
                >
                  <p className="truncate font-medium text-ink">{t.subject}</p>
                  <Badge tone={t.status === "abierto" ? "secondary" : "neutral"}>
                    {TICKET_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
