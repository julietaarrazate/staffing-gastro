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
import type { AdminUserDetail, ShiftStatus, SuspensionPreview, WorkerSkill } from "@/lib/types";
import { formatAmountDue } from "@/lib/pay";
import { formatShiftDate } from "@/lib/datetime";
import { formatPunctuality, formatRateOrNone, formatRatingOrNone, hasPaymentRate, levelLabel } from "@/lib/reputation";
import { useTapGuard } from "@/lib/use-tap-guard";
import {
  Avatar,
  Badge,
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  Modal,
} from "@/components/ui";
import { CheckCircleIcon, EyeIcon, UsersIcon } from "@/components/icons";
import { AdminHeading, SectionLabel } from "@/components/admin/AdminStats";
import PlanCompromiso from "@/components/admin/PlanCompromiso";
import CerrarTurnoDialog, { type CerrarTurnoTarget } from "@/components/admin/CerrarTurnoDialog";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  TICKET_STATUS_LABELS,
  adminCloseHint,
  suspensionImpactLines,
} from "@/components/admin/people";

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
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
  // Qué les pasa a sus turnos si se suspende (ADR-0024): se pide al abrir el
  // diálogo, para que la admin lo vea antes de confirmar.
  const [preview, setPreview] = useState<SuspensionPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  // «Cerrar turno» de una cuenta suspendida (decisión 21): el turno elegido,
  // con lo que haría según el backend.
  const [closing, setClosing] = useState<CerrarTurnoTarget | null>(null);
  // El doble toque sobre «Cerrar turno» no confirma el diálogo que abre.
  const tapGuard = useTapGuard();

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

  function askSuspend() {
    if (!token || !detail) return;
    setPreview(null);
    setPreviewFailed(false);
    setConfirm("suspend");
    api
      .get<SuspensionPreview>(`/admin/users/${detail.user.id}/suspension-preview`, token)
      .then(setPreview)
      .catch(() => setPreviewFailed(true));
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

  const volver = { href: "/admin/personas", label: "Volver a Personas" };

  if (notFound) {
    return (
      <div>
        <AdminHeading title="Personas" volver={volver} />
        <div>
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
        <AdminHeading title="Personas" volver={volver} />
        {error ? (
          <div>
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : (
          <div>
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
      <AdminHeading title={u.full_name} subtitle={u.email} volver={volver} />

      <div className="flex items-center gap-4">
        <Avatar src={u.photo_url} name={u.full_name} size="lg" />
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {u.is_verified && (
            <Badge tone="trust" icon={<CheckCircleIcon size={14} />}>
              <span className="sr-only">Verificado</span>
            </Badge>
          )}
          <Badge tone="neutral">{ROLE_LABELS[u.role] ?? u.role}</Badge>
          <Badge tone={u.status === "active" ? "secondary" : "danger"}>
            {STATUS_LABELS[u.status] ?? u.status}
          </Badge>
          {u.created_at && <Badge tone="neutral">Desde {formatShiftDate(u.created_at)}</Badge>}
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
            onClick={askSuspend}
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
        <p className="text-sm text-ink-soft">
          {confirm === "suspend"
            ? "No va a poder entrar a la app hasta que la reactives."
            : "Va a ver y manejar todo el panel de administración, como vos."}
        </p>
        {confirm === "suspend" && (
          <div className="caja-suave mt-3 p-3.5" aria-live="polite">
            <p className="text-xs font-semibold text-ink-soft">Sus turnos</p>
            {preview ? (
              <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-ink">
                {suspensionImpactLines(preview).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : previewFailed ? (
              <p className="mt-1.5 text-sm text-danger-text">
                No pudimos contar sus turnos. Si la suspendés igual, se cancelan o reabren
                los que correspondan.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-ink-soft">Contando sus turnos…</p>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirm(null)}>
            Volver
          </Button>
          <Button
            // «Hacer admin» con la acción principal (ámbar): `dark` daba 1,1:1
            // contra el diálogo en oscuro.
            variant={confirm === "suspend" ? "danger" : "primary"}
            size="sm"
            // Primero se ve qué toca: mientras se cuenta, no se confirma.
            disabled={confirm === "suspend" && preview === null && !previewFailed}
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
          <div className="tarjeta-suave mt-2 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Turnos completados" value={detail.worker.events_completed} />
              <Fact label="Calificación" value={formatRatingOrNone(detail.worker.rating)} />
              <Fact label="Puntualidad" value={formatRateOrNone(detail.worker.punctuality_rate, detail.worker.events_completed)} />
              <Fact label="Nivel" value={levelLabel(detail.worker.level)} />
              <Fact label="Cancelaciones" value={detail.worker.cancellations} />
              <Fact label="No se presentó" value={detail.worker.no_shows} />
              <Fact label="Experiencia" value={`${detail.worker.years_experience} años`} />
              <Fact label="Disponible" value={detail.worker.is_available ? "Sí" : "No"} />
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              {detail.worker.skills.map(skillLabel).join(" · ") || "Sin puestos cargados"}
              {detail.worker.city ? ` — ${detail.worker.city}` : ""}
            </p>
          </div>
        </div>
      )}

      {detail.company && (
        <div className="mt-8">
          <SectionLabel>Como comercio</SectionLabel>
          <div className="tarjeta-suave mt-2 p-5">
            <p className="font-semibold text-ink">{detail.company.name}</p>
            <p className="text-sm text-ink-soft">
              {[detail.company.address, detail.company.city].filter(Boolean).join(", ") ||
                "Sin dirección cargada"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Turnos publicados" value={detail.company.events_published} />
              <Fact label="Calificación" value={formatRatingOrNone(detail.company.rating)} />
              <Fact
                label="Paga a tiempo"
                value={hasPaymentRate(detail.company.payments_recorded, detail.company.events_published)
                    ? formatPunctuality(detail.company.on_time_payment_rate)
                    : "Sin pagos"}
              />
              <Fact label="Cancelaciones tardías" value={detail.company.late_cancellations} />
            </div>
          </div>
        </div>
      )}

      {detail.company && detail.subscription && token && (
        <PlanCompromiso
          userId={detail.user.id}
          token={token}
          summary={detail.subscription}
          onChange={(subscription) => setDetail({ ...detail, subscription })}
        />
      )}

      {(detail.worker || detail.company) && (
        <div className="mt-8">
          <SectionLabel>Turnos recientes</SectionLabel>
          {detail.recent_shifts.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-ink-soft">Todavía no tiene turnos.</p>
          ) : (
            <ul className="perfil-filas !mt-2">
              {detail.recent_shifts.map((s) => {
                const name = s.title || skillLabel(s.position);
                const closeAction = s.admin_close;
                return (
                  <li key={s.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{name}</p>
                        <p className="text-xs text-ink-soft">
                          {formatShiftDate(s.start_at)} · {formatAmountDue(s)}
                        </p>
                      </div>
                      {/* Sin achicarse: un título largo cortaba el estado en dos
                          renglones («Check-» / «in») a 390 px. */}
                      <div className="shrink-0 whitespace-nowrap">
                        {s.absent ? (
                          <Badge tone="danger">No se presentó</Badge>
                        ) : (
                          <Badge tone="neutral">
                            {SHIFT_STATUS_LABELS[s.status as ShiftStatus] ?? s.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {closeAction && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="text-xs text-ink-soft">{adminCloseHint(closeAction)}</p>
                        <Button
                          size="sm"
                          variant="surface"
                          disabled={tapGuard.locked || busy !== null}
                          onClick={() =>
                            void tapGuard.run(() =>
                              setClosing({ id: s.id, name, action: closeAction })
                            )
                          }
                        >
                          Cerrar turno
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {closing && token && (
        <CerrarTurnoDialog
          key={closing.id}
          target={closing}
          token={token}
          tapGuard={tapGuard}
          onClose={() => setClosing(null)}
          onChanged={load}
        />
      )}

      <div className="mt-8">
        <SectionLabel>Soporte</SectionLabel>
        {detail.tickets.length === 0 ? (
          <p className="mt-2 px-1 text-sm text-ink-soft">No abrió tickets.</p>
        ) : (
          <ul className="perfil-filas !mt-2">
            {detail.tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/support/${t.id}`}
                  className="admin-fila-link flex items-center justify-between gap-3 px-4 py-3"
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
