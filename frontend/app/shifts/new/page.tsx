"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { SKILL_LABELS, Shift, WORKER_SKILLS, WorkerSkill } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { argentinaISOToLocalInput, localInputToArgentinaISO } from "@/lib/datetime";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
import ShiftPublishedNextSteps from "@/components/ShiftPublishedNextSteps";
import { Button, TextField, useToast } from "@/components/ui";
import { ChevronLeftIcon, FlameIcon, MapPinIcon } from "@/components/icons";

const STEPS = ["Puesto", "Personas", "Cuándo", "Pago", "Publicar"];

// Duplicar un turno (frontend puro, ver spec de crecimiento): movemos el
// horario +7 días manteniendo la misma hora de pared en Argentina.
const DUPLICATE_SHIFT_OFFSET_DAYS = 7;

function shiftDateBy(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export default function NewShiftPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <NewShiftWizard />
    </Suspense>
  );
}

function NewShiftWizard() {
  const { token } = useAuth();
  const { requestOptIn } = usePushPrompt();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [position, setPosition] = useState<WorkerSkill | null>(null);
  // Por ahora, un turno = una persona (R1.4): la cantidad queda fija.
  const quantity = 1;
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [tips, setTips] = useState(true);
  const [urgent, setUrgent] = useState(false);
  const [dressCode, setDressCode] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  // Pantalla "esto es lo que sigue" (Fix 2, docs/PULIDO_ROADMAP.md): se
  // guarda el id recién publicado y se navega recién cuando el comercio
  // interactúa con la pantalla (no de inmediato), a diferencia del
  // `router.push` automático que había antes.
  const [publishedShiftId, setPublishedShiftId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  // Duplicar: precarga el wizard con los datos del turno original (fechas
  // +7 días, misma hora) y lo deja listo en el último paso para revisar y
  // publicar. Sólo frontend: reusa este mismo formulario y el POST de alta.
  useEffect(() => {
    if (!duplicateId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const original = await api.get<Shift>(`/shifts/${duplicateId}`, token);
        if (cancelled) return;
        setPosition(original.position);
        setStartAt(
          argentinaISOToLocalInput(shiftDateBy(original.start_at, DUPLICATE_SHIFT_OFFSET_DAYS))
        );
        setEndAt(
          argentinaISOToLocalInput(shiftDateBy(original.end_at, DUPLICATE_SHIFT_OFFSET_DAYS))
        );
        setPayAmount(String(original.pay_amount));
        setTips(original.tips);
        setUrgent(original.urgent);
        setDressCode(original.dress_code ?? "");
        setCity(original.city ?? "");
        setLatitude(original.latitude);
        setLongitude(original.longitude);
        setStep(STEPS.length - 1);
        toast("Turno duplicado: revisá los datos antes de publicar");
      } catch (err) {
        toast(getErrorMessage(err, "No se pudo duplicar el turno"), "error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateId, token]);

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  const canNext =
    (step === 0 && position !== null) ||
    (step === 1 && quantity >= 1) ||
    (step === 2 && startAt !== "" && endAt !== "" && endAt > startAt) ||
    (step === 3 && Number(payAmount) > 0) ||
    step === 4;

  async function publish() {
    if (!token || position === null) return;
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string }>(
        "/shifts",
        {
          position,
          quantity,
          start_at: localInputToArgentinaISO(startAt),
          end_at: localInputToArgentinaISO(endAt),
          pay_amount: payAmount,
          currency: "ARS",
          tips,
          urgent,
          dress_code: dressCode || null,
          city: city || null,
          latitude,
          longitude,
        },
        token
      );
      try {
        // Idempotencia (product/IDEMPOTENCIA_SPEC.md): protege el POST de
        // publicación en sí (el turno recién creado ya tiene un id propio,
        // así que la key es por-turno).
        await api.post(
          `/shifts/${created.id}/publish`,
          undefined,
          token,
          undefined,
          keyFor(created.id)
        );
        clearIdempotencyKey(created.id);
        // Primera acción significativa del comercio, no al aterrizar (ver
        // docs/ACCESO_MODERNO.md): acá tiene sentido preguntar si quiere
        // enterarse por push apenas alguien se postule.
        requestOptIn();
        // Reemplaza el toast + redirect inmediato por la pantalla "esto es lo
        // que sigue" (Fix 2): el `router.push` queda a cargo de esa pantalla.
        setPublishedShiftId(created.id);
      } catch (err) {
        // El turno ya quedó creado como borrador: se puede publicar más tarde
        // desde el panel una vez que se mejore el plan (ver /shifts).
        if (isPlanLimitError(err)) {
          setPlanLimitMessage(getErrorMessage(err));
        } else {
          toast(getErrorMessage(err, "No se pudo publicar"), "error");
        }
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "No se pudo publicar", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem-5rem)] max-w-md flex-col px-4 pb-4 pt-4 md:min-h-[calc(100dvh-4rem)]">
      {/* Header con progreso */}
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <button
            onClick={() => go(step - 1)}
            aria-label="Atrás"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink/60 ring-1 ring-line"
          >
            <ChevronLeftIcon size={18} />
          </button>
        ) : (
          <button
            onClick={() => router.push("/shifts")}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink/60 ring-1 ring-line"
          >
            <ChevronLeftIcon size={18} />
          </button>
        )}
        <div className="flex flex-1 gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      {/* Pasos */}
      <div className="relative flex-1 overflow-hidden pt-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reducedMotion ? false : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reducedMotion ? 0 : dir * -40 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className="h-full"
          >
            {step === 0 && (
              <div>
                <h1 className="text-2xl font-extrabold text-ink">¿Qué necesitás?</h1>
                <p className="mt-1 text-sm text-ink/50">Elegí el puesto a cubrir.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {WORKER_SKILLS.map((skill) => {
                    const { Icon, bg, fg } = SKILL_ACCENT[skill];
                    const active = position === skill;
                    return (
                      <motion.button
                        key={skill}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPosition(skill)}
                        className={`flex flex-col items-center gap-2 rounded-3xl p-4 ring-1 transition ${
                          active ? "bg-orange-50 ring-primary" : "bg-white ring-line"
                        }`}
                      >
                        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bg} ${fg}`}>
                          <Icon size={22} />
                        </span>
                        <span className="text-sm font-semibold text-ink/80">{SKILL_LABELS[skill]}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <h1 className="text-2xl font-extrabold text-ink">¿Cuántas personas?</h1>
                <p className="mt-1 text-sm text-ink/50">Para este puesto.</p>
                <div className="mt-10 flex items-center gap-6">
                  <button
                    disabled
                    aria-disabled
                    className="flex h-14 w-14 cursor-not-allowed items-center justify-center rounded-full bg-surface text-3xl font-bold text-ink/25 ring-1 ring-line"
                  >
                    −
                  </button>
                  <span className="w-20 text-6xl font-extrabold text-ink">{quantity}</span>
                  <button
                    disabled
                    aria-disabled
                    className="flex h-14 w-14 cursor-not-allowed items-center justify-center rounded-full bg-line text-3xl font-bold text-ink/40"
                  >
                    +
                  </button>
                </div>
                <p className="mt-6 max-w-xs text-sm text-ink/50">
                  Por ahora, un turno = una persona. Para varios puestos creá varios
                  turnos.
                </p>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="text-2xl font-extrabold text-ink">¿Cuándo?</h1>
                <p className="mt-1 text-sm text-ink/50">Inicio y fin del turno.</p>
                <div className="mt-6 flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink/70">Inicio</span>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="min-h-[48px] rounded-2xl bg-surface px-4 text-[15px] ring-1 ring-line focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink/70">Fin</span>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="min-h-[48px] rounded-2xl bg-surface px-4 text-[15px] ring-1 ring-line focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="text-2xl font-extrabold text-ink">¿Cuánto pagás?</h1>
                <p className="mt-1 text-sm text-ink/50">Por persona, en pesos.</p>
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40">
                  <span className="text-2xl font-bold text-ink/40">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="15000"
                    className="min-h-[56px] w-full bg-transparent text-2xl font-extrabold text-ink outline-none"
                  />
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <Toggle label="Acepta propinas" checked={tips} onChange={setTips} />
                  <Toggle
                    label="Urgente"
                    checked={urgent}
                    onChange={setUrgent}
                    icon={<FlameIcon size={16} className="text-danger" />}
                  />
                </div>
                <div className="mt-5">
                  <TextField label="Dress code (opcional)" value={dressCode} onChange={setDressCode} placeholder="Ej: camisa negra" />
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h1 className="text-2xl font-extrabold text-ink">¿Dónde es?</h1>
                <p className="mt-1 text-sm text-ink/50">
                  Elegí la zona: completamos las coordenadas para recomendarte gente cerca.
                </p>
                <div className="mt-5">
                  <LocationPicker
                    onSelect={(loc: LocationSelection) => {
                      setCity(loc.city);
                      setLatitude(loc.latitude);
                      setLongitude(loc.longitude);
                    }}
                  />
                </div>
                {city && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-primary">
                    <MapPinIcon size={15} /> {city}
                  </p>
                )}
                {/* Resumen */}
                <div className="mt-6 rounded-3xl bg-surface p-4 text-sm text-ink/70">
                  <p className="font-bold text-ink">{position && SKILL_LABELS[position]}</p>
                  <p className="mt-1 text-ink/50">
                    {quantity} {quantity === 1 ? "persona" : "personas"} · ARS{" "}
                    {Number(payAmount || 0).toLocaleString("es-AR")}
                    {urgent && " · Urgente"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Acción */}
      <div className="pt-3">
        {step < STEPS.length - 1 ? (
          <Button fullWidth size="lg" disabled={!canNext} onClick={() => go(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button fullWidth size="lg" loading={submitting} onClick={publish}>
            Publicar turno
          </Button>
        )}
      </div>

      <PlanLimitModal
        open={planLimitMessage !== null}
        message={planLimitMessage}
        onClose={() => {
          setPlanLimitMessage(null);
          // El borrador ya existe: lo puede publicar desde el panel cuando
          // mejore el plan (o si el límite se liberó al empezar un mes nuevo).
          router.push("/shifts");
        }}
      />

      <ShiftPublishedNextSteps
        open={publishedShiftId !== null}
        onClose={() => {
          setPublishedShiftId(null);
          router.push("/shifts");
        }}
        onViewShift={() => {
          const id = publishedShiftId;
          setPublishedShiftId(null);
          if (id) router.push(`/shifts/${id}/candidates`);
        }}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-line"
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink/80">
        {icon} {label}
      </span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-secondary" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
