"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { getErrorMessage } from "@/lib/errors";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { EventResult, SKILL_LABELS, WORKER_SKILLS, WorkerSkill } from "@/lib/types";
import { argentinaISOToLocalInput, localInputToArgentinaISO } from "@/lib/datetime";
import { AI_EVENT_DRAFT_STORAGE_KEY, AssistantEventDraft } from "@/lib/use-ai-assistant";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import { Button, TextField, Toggle, useToast } from "@/components/ui";
import { ChevronLeftIcon, FlameIcon, MapPinIcon, PlusIcon, TrashIcon, UtensilsIcon } from "@/components/icons";

interface RoleRow {
  key: string;
  position: WorkerSkill;
  count: string;
  payAmount: string;
}

function newRole(overrides?: Partial<Pick<RoleRow, "position" | "count" | "payAmount">>): RoleRow {
  return { key: crypto.randomUUID(), position: "mozo", count: "1", payAmount: "", ...overrides };
}

/**
 * Publicar para un evento (catering, boda, etc. que necesita varios roles a
 * la vez): un solo formulario con los datos compartidos + una fila por rol
 * ("3 mozos", "2 bartenders"...), en vez de repetir el wizard de un turno N
 * veces (Julieta, 2026-08-01). Cada rol se publica como turno individual
 * (`POST /shifts/events`, ver backend) — la publicación puede quedar
 * parcial si el plan del comercio se queda sin cupo a mitad de camino.
 */
export default function NewEventPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <NewEventForm />
    </Suspense>
  );
}

function NewEventForm() {
  const { token } = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [dressCode, setDressCode] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [tips, setTips] = useState(true);
  const [meal, setMeal] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([newRole()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EventResult | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  // Handoff del asistente (AIAssistantBar): ya clasificó el pedido
  // como "crear_evento" y parseó los roles con IA en otra pantalla — lo
  // aplicamos una sola vez al montar y limpiamos el rastro (storage +
  // querystring) para que un refresh no lo reaplique. El comercio sigue
  // revisando/editando cada rol a mano antes de publicar.
  useEffect(() => {
    if (searchParams.get("ai") !== "1") return;
    const raw = sessionStorage.getItem(AI_EVENT_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(AI_EVENT_DRAFT_STORAGE_KEY);
    router.replace("/shifts/new-event");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as AssistantEventDraft;
      if (draft.event_positions.length > 0) {
        setRoles(
          draft.event_positions.map((role) =>
            newRole({
              position: role.position as WorkerSkill,
              count: String(role.quantity),
              payAmount: draft.pay_amount ?? "",
            })
          )
        );
      }
      if (draft.start_at) setStartAt(argentinaISOToLocalInput(draft.start_at));
      if (draft.end_at) setEndAt(argentinaISOToLocalInput(draft.end_at));
      if (draft.dress_code) setDressCode(draft.dress_code);
      setUrgent(draft.urgent);
      setTips(draft.tips);
      setMeal(draft.meal);
      toast("Completamos lo que pudimos — revisá cada rol antes de publicar");
    } catch {
      // Draft corrupto/inesperado: no rompe el formulario, se completa a mano.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRole(key: string, patch: Partial<RoleRow>) {
    setRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRole(key: string) {
    setRoles((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const totalRequested = roles.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
  const canSubmit =
    name.trim() !== "" &&
    startAt !== "" &&
    endAt !== "" &&
    endAt > startAt &&
    roles.every((r) => Number(r.count) >= 1 && Number(r.payAmount) > 0);

  async function submit() {
    if (!token || !canSubmit) return;
    setSubmitting(true);
    try {
      // Idempotencia (D3, auditoría de producto/UI 2026-08-09): un evento
      // crea varios turnos de una sola vez (uno por rol) — sin esto, un
      // reintento tras un timeout/corte de red que sí llegó a crearlos
      // duplica el set entero, no sólo un turno.
      const created = await api.post<EventResult>(
        "/shifts/events",
        {
          name,
          start_at: localInputToArgentinaISO(startAt),
          end_at: localInputToArgentinaISO(endAt),
          city: city || null,
          latitude,
          longitude,
          dress_code: dressCode || null,
          urgent,
          tips,
          meal,
          roles: roles.map((r) => ({
            position: r.position,
            count: Number(r.count),
            pay_amount: r.payAmount,
          })),
        },
        token,
        undefined,
        keyFor("create-event")
      );
      clearIdempotencyKey("create-event");
      setResult(created);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : getErrorMessage(err, "No se pudo publicar el evento"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const missing = result.requested - result.shifts.length;
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col px-4 pb-4 pt-4 md:min-h-[calc(100dvh-var(--chrome-top))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-display text-h1 font-semibold text-ink">
            {missing === 0 ? "¡Evento publicado!" : "Evento publicado (parcial)"}
          </h1>
          <p className="mt-2 text-ink/60">
            Se publicaron {result.shifts.length} de {result.requested} turnos.
          </p>
          {missing > 0 && (
            <p className="mt-3 max-w-xs rounded-2xl bg-primary-tint p-3 text-sm text-primary-text">
              Tu plan no alcanza para los {missing} turnos restantes.{" "}
              <button
                type="button"
                onClick={() => router.push("/subscription")}
                className="font-bold underline"
              >
                Mejorá tu plan
              </button>{" "}
              para publicarlos.
            </p>
          )}
        </div>
        <Button fullWidth size="lg" onClick={() => router.push("/shifts")}>
          Ver mi panel
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col px-4 pb-4 pt-4 md:min-h-[calc(100dvh-var(--chrome-top))]">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/shifts")}
          aria-label="Cerrar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink/60 ring-1 ring-line"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Publicar para un evento</h1>
          <p className="text-sm text-ink/50">Varios roles, un solo formulario.</p>
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-5 pb-4">
        <TextField
          label="Nombre del evento"
          value={name}
          onChange={setName}
          placeholder="Ej: Boda Martínez"
          maxLength={200}
        />

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Inicio</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="min-h-[48px] rounded-2xl bg-surface px-4 text-[15px] ring-1 ring-line focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/70">Fin</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="min-h-[48px] rounded-2xl bg-surface px-4 text-[15px] ring-1 ring-line focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>

        <div>
          <LocationPicker
            onSelect={(loc: LocationSelection) => {
              setCity(loc.city);
              setLatitude(loc.latitude);
              setLongitude(loc.longitude);
            }}
          />
          {city && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-sm font-semibold text-primary-text">
              <MapPinIcon size={15} /> {city}
            </p>
          )}
        </div>

        <TextField
          label="Dress code (opcional)"
          value={dressCode}
          onChange={setDressCode}
          placeholder="Ej: camisa negra"
          maxLength={255}
        />

        <div className="flex flex-col gap-3">
          <Toggle label="Acepta propinas" checked={tips} onChange={setTips} />
          <Toggle label="Incluye comida (perso)" checked={meal} onChange={setMeal} icon={<UtensilsIcon size={16} className="text-ink/50" />} />
          <Toggle
            label="Urgente"
            checked={urgent}
            onChange={setUrgent}
            icon={<FlameIcon size={16} className="text-danger-text" />}
          />
        </div>

        {/* Roles: cada fila es "necesito N de este puesto, a tal pago" —
            se expande server-side a N turnos individuales (quantity=1 cada
            uno, ADR-0003 intacto). */}
        <div>
          <p className="text-sm font-semibold text-ink/70">¿Qué necesitás?</p>
          <div className="mt-2 space-y-3">
            {roles.map((role) => (
              <div key={role.key} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
                <div className="flex items-center gap-2">
                  <select
                    value={role.position}
                    onChange={(e) => updateRole(role.key, { position: e.target.value as WorkerSkill })}
                    className="min-h-[44px] flex-1 rounded-xl bg-card px-3 text-[15px] ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {WORKER_SKILLS.map((skill) => (
                      <option key={skill} value={skill}>
                        {SKILL_LABELS[skill]}
                      </option>
                    ))}
                  </select>
                  {roles.length > 1 && (
                    <button
                      type="button"
                      aria-label="Sacar este rol"
                      onClick={() => removeRole(role.key)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink/40 ring-1 ring-line active:scale-95"
                    >
                      <TrashIcon size={17} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  {/* min-w-0: sin esto, dos <input type="number"> flex-1 no se
                      achican por debajo de su ancho intrínseco (con spinner
                      nativo, ~170px+) y desbordan el contenedor en viewports
                      angostos (confirmado con Playwright, hallazgo E1 de la
                      auditoría de producto/UI 2026-08-09). */}
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs font-semibold text-ink/50">Cantidad</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={role.count}
                      onChange={(e) => updateRole(role.key, { count: e.target.value })}
                      className="min-h-[44px] min-w-0 rounded-xl bg-card px-3 text-[15px] ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs font-semibold text-ink/50">Pago c/u</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="15000"
                      value={role.payAmount}
                      onChange={(e) => updateRole(role.key, { payAmount: e.target.value })}
                      className="min-h-[44px] min-w-0 rounded-xl bg-card px-3 text-[15px] ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRoles((prev) => [...prev, newRole()])}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary-text"
          >
            <PlusIcon size={16} /> Agregar otro rol
          </button>
        </div>

        {totalRequested > 0 && (
          <p className="rounded-2xl bg-surface p-3 text-sm text-ink/60">
            En total: <strong className="text-ink">{totalRequested}</strong>{" "}
            {totalRequested === 1 ? "persona" : "personas"}.
          </p>
        )}
      </div>

      <Button fullWidth size="lg" disabled={!canSubmit} loading={submitting} onClick={submit}>
        Publicar evento
      </Button>
    </div>
  );
}

