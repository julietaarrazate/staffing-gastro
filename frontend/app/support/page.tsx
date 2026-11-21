"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { SubpaginaSuave } from "@/components/profile/ProfileParts";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { parseSupportPrefill } from "@/lib/support-reference";
import { formatShiftDate, formatShiftTime } from "@/lib/datetime";
import {
  SupportReferences,
  SupportTicket,
  TICKET_CATEGORY_LABELS,
  TicketCategory,
} from "@/lib/types";
import {
  Badge,
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  Modal,
  TextField,
  useToast,
} from "@/components/ui";
import { MessageIcon, PlusIcon } from "@/components/icons";

const CATEGORIES: TicketCategory[] = [
  "general",
  "cv_documentos",
  "pagos",
  "cuenta",
  "turno",
  "comercio",
  "otro",
];

type Reference = { shiftId: string | null; companyId: string | null };

// «Reportar un problema» (U110) abre esta pantalla con `?categoria=…&turno=…`
// o `?comercio=…`: el formulario sale precargado y se muestra de qué turno o
// comercio se trata, para que la persona lo confirme.
export default function SupportPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <SupportContent />
    </Suspense>
  );
}

function SupportContent() {
  const { token } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { keyFor, clear } = useIdempotencyKeys();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Turno o comercio atado al ticket nuevo (sólo si la persona lo trae de
  // «Reportar un problema») y lo que el servidor contestó de él.
  const [reference, setReference] = useState<Reference | null>(null);
  const [refInfo, setRefInfo] = useState<SupportReferences | null>(null);
  const [refMissing, setRefMissing] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<SupportTicket[]>("/support/tickets/mine", token)
      .then((data) => {
        setTickets(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar tus tickets")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Precarga desde la URL: una vez por llegada (cambia sólo si cambia la URL).
  const prefillKey = searchParams.toString();
  useEffect(() => {
    const prefill = parseSupportPrefill(searchParams);
    if (!prefill) return;
    setCategory(prefill.category);
    setReference({ shiftId: prefill.shiftId, companyId: prefill.companyId });
    setRefInfo(null);
    setRefMissing(false);
    setShowNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  // Qué turno o comercio se va a atar: lo contesta el servidor con las mismas
  // reglas que al crear el ticket. Si no lo encuentra (o no es de esa persona)
  // el ticket se manda igual, sin referencia.
  useEffect(() => {
    if (!token || !reference) return;
    let cancelled = false;
    const query = reference.shiftId
      ? `shift_id=${reference.shiftId}`
      : `company_id=${reference.companyId}`;
    api
      .get<SupportReferences>(`/support/reference?${query}`, token)
      .then((data) => {
        if (!cancelled) setRefInfo(data);
      })
      .catch(() => {
        if (!cancelled) setRefMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reference]);

  function dropReference() {
    setReference(null);
    setRefInfo(null);
    setRefMissing(false);
  }

  function resetForm() {
    setCategory("general");
    setSubject("");
    setBody("");
    dropReference();
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    // U012: mismo formulario reintentado = misma key (no duplica el ticket).
    const shiftId = refInfo?.shift ? refInfo.shift.id : null;
    const companyId = refInfo?.company ? refInfo.company.id : null;
    const attempt = JSON.stringify([category, subject, body, shiftId, companyId]);
    try {
      const ticket = await api.post<SupportTicket>(
        "/support/tickets",
        {
          category,
          subject,
          body,
          ...(shiftId ? { shift_id: shiftId } : {}),
          ...(companyId ? { company_id: companyId } : {}),
        },
        token,
        undefined,
        keyFor(attempt)
      );
      clear(attempt);
      setShowNew(false);
      resetForm();
      router.push(`/support/${ticket.id}`);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo abrir el ticket"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const showEmptyState = !loading && !error && tickets.length === 0;

  return (
    // Con la dirección suave (ADR-0028, 2026-11-21; sin maqueta): el cielo
    // corto con el título y la vuelta a Ajustes (por donde se llega), y la
    // hoja con los tickets como tarjetas suaves.
    <SubpaginaSuave
      title="Soporte"
      bajada="¿Algún problema con la app? Contanos y te respondemos por acá."
      volver={{ href: "/profile/settings", label: "Volver a Ajustes" }}
    >
      {/* Con la lista vacía este botón NO va: el estado vacío ya trae su
          propio «Abrir un ticket», y serían dos ámbar para la misma acción
          (un solo acento por pantalla, ADR-0011). Aparece recién cuando hay
          tickets y el foco pasa a la lista. */}
      {!showEmptyState && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setShowNew(true)}>
            <PlusIcon size={16} /> Nuevo
          </Button>
        </div>
      )}

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {showEmptyState && (
        <div>
          <EmptyState
            icon={<MessageIcon size={28} />}
            title="Todavía no abriste ningún ticket"
            subtitle="Si tenés un problema con la app, contanos acá y te respondemos."
            primaryAction={{ label: "Abrir un ticket", onClick: () => setShowNew(true) }}
          />
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="tecla block p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold text-ink">{t.subject}</p>
                <Badge tone={t.status === "abierto" ? "secondary" : "neutral"}>
                  {t.status === "abierto" ? "Abierto" : "Cerrado"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{TICKET_CATEGORY_LABELS[t.category]}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo ticket de soporte">
        <form onSubmit={submitTicket} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Categoría</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="campo min-h-[48px] w-full rounded-[var(--radius-input)] bg-card px-4 text-body text-ink outline-none ring-1 ring-line transition"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          {reference && (refInfo || refMissing) && (
            <div
              data-testid="ticket-reference"
              className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3 ring-1 ring-line"
            >
              <div className="min-w-0 text-sm">
                {refInfo?.shift ? (
                  <>
                    <p className="text-xs font-semibold text-ink/50">Turno que reportás</p>
                    <p className="truncate font-semibold text-ink">{refInfo.shift.title}</p>
                    <p className="text-ink/60">
                      {formatShiftDate(refInfo.shift.start_at)} · {formatShiftTime(refInfo.shift.start_at)}
                      {refInfo.shift.company_name ? ` · ${refInfo.shift.company_name}` : ""}
                    </p>
                  </>
                ) : refInfo?.company ? (
                  <>
                    <p className="text-xs font-semibold text-ink/50">Comercio que reportás</p>
                    <p className="truncate font-semibold text-ink">{refInfo.company.name}</p>
                  </>
                ) : (
                  <p className="text-ink/60">
                    No pudimos asociar el turno o comercio. Contanos igual qué pasó y lo vemos.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={dropReference}
                className="shrink-0 text-sm font-semibold text-primary-text"
              >
                Quitar
              </button>
            </div>
          )}

          <TextField
            label="Asunto"
            value={subject}
            onChange={setSubject}
            placeholder="Resumen corto de tu problema"
            maxLength={200}
            required
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Contanos qué pasa</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describí el problema con el mayor detalle posible"
              maxLength={2000}
              required
              rows={5}
              className="campo w-full rounded-[var(--radius-input)] bg-card px-4 py-3 text-body text-ink outline-none ring-1 ring-line transition"
            />
          </label>

          <div className="mt-1 flex gap-2">
            <Button type="button" variant="surface" fullWidth onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            {/* Hasta que el servidor confirma el turno o comercio, no se manda:
                si no, el ticket saldría sin la referencia. */}
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              disabled={Boolean(reference) && !refInfo && !refMissing}
            >
              Enviar
            </Button>
          </div>
        </form>
      </Modal>
    </SubpaginaSuave>
  );
}
