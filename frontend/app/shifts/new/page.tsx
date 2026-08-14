"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { ParsedShiftDraft, SKILL_LABELS, Shift, WORKER_SKILLS, WorkerSkill } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import {
  argentinaISOToLocalInput,
  formatDuration,
  formatShiftRange,
  localInputToArgentinaISO,
  shiftDurationMinutes,
} from "@/lib/datetime";
import { useVoiceDictation } from "@/lib/use-voice-dictation";
import { AI_SHIFT_DRAFT_STORAGE_KEY } from "@/lib/use-ai-assistant";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
import ShiftPublishedNextSteps from "@/components/ShiftPublishedNextSteps";
import { Button, TextField, Toggle, useToast } from "@/components/ui";
import {
  CalendarIcon,
  ChevronLeftIcon,
  FlameIcon,
  MapPinIcon,
  MicIcon,
  MicOffIcon,
  SparklesIcon,
  UsersIcon,
  UtensilsIcon,
  WalletIcon,
} from "@/components/icons";

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
  const { token } = useRequireAuth();
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
  const [meal, setMeal] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [dressCode, setDressCode] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  // Turno por texto libre (P2, auditoría de producto 2026-08-10): la IA sólo
  // PRECARGA estos mismos campos de estado — el comercio sigue revisando y
  // confirmando cada paso a mano antes de publicar. Nunca crea el turno.
  const [describeText, setDescribeText] = useState("");
  const [parsingText, setParsingText] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // Dictado por voz (pedido de Julieta: "es donde más se aprovecha" un
  // asistente de IA — más rápido hablar el turno que tipearlo).
  const { listening, supported: speechSupported, toggle: toggleDictation } = useVoiceDictation(
    (transcript) =>
      setDescribeText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, 500))
  );
  // Pantalla "esto es lo que sigue" (Fix 2, docs/planning/PULIDO_ROADMAP.md): se
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
        setMeal(original.meal);
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

  function applyParsedDraft(draft: ParsedShiftDraft) {
    if (draft.position) setPosition(draft.position);
    if (draft.start_at) setStartAt(argentinaISOToLocalInput(draft.start_at));
    if (draft.end_at) setEndAt(argentinaISOToLocalInput(draft.end_at));
    if (draft.pay_amount) setPayAmount(draft.pay_amount);
    setTips(draft.tips);
    setMeal(draft.meal);
    setUrgent(draft.urgent);
    if (draft.dress_code) setDressCode(draft.dress_code);
    toast("Completamos lo que pudimos — revisá cada paso antes de publicar");
  }

  async function parseWithAI() {
    if (!token || !describeText.trim()) return;
    setParseError(null);
    setParsingText(true);
    try {
      const draft = await api.post<ParsedShiftDraft>(
        "/shifts/parse-text",
        { text: describeText.trim() },
        token
      );
      applyParsedDraft(draft);
    } catch (err) {
      setParseError(getErrorMessage(err, "No pudimos interpretar el texto. Completá los datos a mano."));
    } finally {
      setParsingText(false);
    }
  }

  // Handoff del asistente flotante (AIAssistantFab, fuera del wizard): ya
  // parseó el texto con IA en otra pantalla y nos manda acá con el draft
  // guardado — lo aplicamos una sola vez al montar y limpiamos el rastro
  // (storage + querystring) para que un refresh no lo reaplique.
  useEffect(() => {
    if (searchParams.get("ai") !== "1") return;
    const raw = sessionStorage.getItem(AI_SHIFT_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(AI_SHIFT_DRAFT_STORAGE_KEY);
    router.replace("/shifts/new");
    if (!raw) return;
    try {
      applyParsedDraft(JSON.parse(raw) as ParsedShiftDraft);
    } catch {
      // Draft corrupto/inesperado: no rompe el wizard, el comercio completa a mano.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Duración del turno, derivada de inicio/fin (feedback de Julieta 2026-08-06:
  // "no se entiende si es 1 día o más"). Se muestra en vivo en el paso "Cuándo"
  // y habilita el equivalente por hora del paso "Pago" ("¿es por hora o por
  // turno?"). Null mientras falte un extremo o el rango sea inválido.
  const durationMinutes =
    startAt !== "" && endAt !== ""
      ? shiftDurationMinutes(localInputToArgentinaISO(startAt), localInputToArgentinaISO(endAt))
      : null;
  // Un turno es UNA sola jornada de trabajo (no hay turnos de varios días).
  // Mostramos el rango elegido en formato AR (dd/mm/yyyy, 24 h) para que la
  // fecha no se malinterprete sin importar el locale del dispositivo. Un rango
  // de más de un día es un error real (umbral 24 h): ahí sí conviene un evento.
  const whenLabel =
    durationMinutes != null
      ? formatShiftRange(localInputToArgentinaISO(startAt), localInputToArgentinaISO(endAt))
      : null;
  const spansMultipleDays = durationMinutes != null && durationMinutes > 24 * 60;
  const payPerHour =
    durationMinutes != null && durationMinutes > 0 && Number(payAmount) > 0
      ? Math.round(Number(payAmount) / (durationMinutes / 60))
      : null;

  async function publish() {
    if (!token || position === null) return;
    setSubmitting(true);
    try {
      // Idempotencia (D3, auditoría de producto/UI 2026-08-09): antes sólo
      // el POST de publicación estaba protegido — un reintento tras un
      // timeout/corte de red que sí llegó a crear el turno duplicaba el
      // turno al reintentar desde cero. Key estable por intento del wizard
      // (no por-turno: el turno todavía no existe en el primer intento).
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
          meal,
          urgent,
          dress_code: dressCode || null,
          city: city || null,
          latitude,
          longitude,
        },
        token,
        undefined,
        keyFor("create-shift")
      );
      clearIdempotencyKey("create-shift");
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
        // docs/reference/ACCESO_MODERNO.md): acá tiene sentido preguntar si quiere
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
    <div className="mx-auto flex min-h-[calc(100dvh-4rem-5rem)] max-w-md flex-col px-4 pb-4 pt-4 md:min-h-[calc(100dvh-4rem)] lg:max-w-5xl lg:flex-row lg:items-start lg:gap-10 lg:px-6 lg:pt-10">
    <div className="flex flex-1 flex-col">
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
                <h1 className="font-display text-2xl font-semibold text-ink">¿Qué necesitás?</h1>
                <p className="mt-1 text-sm text-ink/50">Elegí el puesto a cubrir.</p>

                {/* Turno por texto libre (P2, auditoría de producto 2026-08-10):
                    la IA sólo PRECARGA los pasos siguientes — nunca publica nada
                    sola, el comercio revisa y confirma cada paso a mano. */}
                <div className="mt-4 rounded-3xl bg-surface p-4 ring-1 ring-line">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink/70">
                    <SparklesIcon size={16} className="text-primary" /> Describilo y lo completamos
                  </p>
                  <div className="relative mt-2">
                    <textarea
                      value={describeText}
                      onChange={(e) => setDescribeText(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Ej: necesito un mozo el sábado a la noche, se paga 45000"
                      className={`w-full resize-none rounded-2xl bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-primary/40 ${
                        speechSupported ? "pr-10" : ""
                      }`}
                    />
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={toggleDictation}
                        aria-label={listening ? "Detener dictado" : "Dictar por voz"}
                        aria-pressed={listening}
                        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition ${
                          listening
                            ? "animate-pulse bg-danger text-white"
                            : "bg-surface text-ink/50 ring-1 ring-line"
                        }`}
                      >
                        {listening ? <MicOffIcon size={14} /> : <MicIcon size={14} />}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {listening ? (
                      <p className="text-xs font-semibold text-primary-text">Escuchando…</p>
                    ) : (
                      parseError && <p className="text-xs text-danger-text">{parseError}</p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto"
                      disabled={!describeText.trim()}
                      loading={parsingText}
                      onClick={parseWithAI}
                    >
                      Completar
                    </Button>
                  </div>
                </div>

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
                <h1 className="font-display text-2xl font-semibold text-ink">¿Cuántas personas?</h1>
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
                <h1 className="font-display text-2xl font-semibold text-ink">¿Cuándo?</h1>
                <p className="mt-1 text-sm text-ink/50">Inicio y fin de la jornada.</p>
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
                {durationMinutes != null && whenLabel && (
                  <div className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm">
                    <p className="font-semibold text-ink/80">{whenLabel}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-ink/50">
                      <CalendarIcon size={14} className="text-ink/40" /> Jornada de {formatDuration(durationMinutes)}
                    </p>
                  </div>
                )}
                {spansMultipleDays && (
                  <div className="mt-4 rounded-2xl bg-orange-50 p-3.5 text-sm text-ink/75 ring-1 ring-orange-100">
                    Un turno es una sola jornada, no dura varios días. Si querés
                    cubrir <strong>varios días o varias jornadas</strong>, conviene{" "}
                    <Link href="/shifts/new-event" className="font-bold text-primary-text underline">
                      publicar un evento
                    </Link>{" "}
                    (crea varias de una).
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">¿Cuánto pagás?</h1>
                <p className="mt-1 text-sm text-ink/50">
                  Pago por la jornada completa, por persona (no por hora).
                </p>
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40">
                  <span className="text-2xl font-bold text-ink/40">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="48000"
                    className="min-h-[56px] w-full bg-transparent text-2xl font-extrabold text-ink outline-none"
                  />
                </div>
                {payPerHour != null && durationMinutes != null && (
                  <p className="mt-2 text-sm text-ink/55">
                    ≈ ${payPerHour.toLocaleString("es-AR")} por hora
                    <span className="text-ink/40"> · jornada de {formatDuration(durationMinutes)}</span>
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-3">
                  <Toggle label="Acepta propinas" checked={tips} onChange={setTips} />
                  <Toggle
                    label="Incluye comida (perso)"
                    checked={meal}
                    onChange={setMeal}
                    icon={<UtensilsIcon size={16} className="text-ink/50" />}
                  />
                  <Toggle
                    label="Urgente"
                    checked={urgent}
                    onChange={setUrgent}
                    icon={<FlameIcon size={16} className="text-danger-text" />}
                  />
                </div>
                <div className="mt-5">
                  <TextField
                    label="Dress code (opcional)"
                    value={dressCode}
                    onChange={setDressCode}
                    placeholder="Ej: camisa negra"
                    maxLength={255}
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">¿Dónde es?</h1>
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
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-primary-text">
                    <MapPinIcon size={15} /> {city}
                  </p>
                )}
                {/* Resumen */}
                <div className="mt-6 rounded-3xl bg-surface p-4 text-sm text-ink/70">
                  <p className="font-bold text-ink">{position && SKILL_LABELS[position]}</p>
                  <p className="mt-1 text-ink/50">
                    {quantity} {quantity === 1 ? "persona" : "personas"} · ARS{" "}
                    {Number(payAmount || 0).toLocaleString("es-AR")}
                    {meal && " · con comida"}
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
    </div>

      {/* Vista previa (lg+): antes el wizard quedaba como una tarjeta angosta
          flotando en el medio de la pantalla en desktop, sin ningún uso del
          espacio de los costados. En vez de sólo ensanchar el formulario (no
          tiene sentido estirar inputs/botones táctiles a todo el ancho), se
          suma este panel fijo al lado con lo mismo que ya se mostraba recién
          en el resumen del último paso — visible desde el principio, se va
          completando a medida que el comercio avanza. */}
      <WizardPreview
        className="hidden lg:block lg:w-[360px] lg:shrink-0"
        position={position}
        quantity={quantity}
        startAt={startAt}
        endAt={endAt}
        payAmount={payAmount}
        tips={tips}
        meal={meal}
        urgent={urgent}
        dressCode={dressCode}
        city={city}
      />

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


/** Fila de la vista previa: ícono + label + valor, o el placeholder si el
 * paso correspondiente todavía no se completó. */
function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ink/50 ring-1 ring-line">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{label}</p>
        <p className={`text-sm font-semibold ${value ? "text-ink" : "text-ink/35"}`}>
          {value ?? "Todavía sin definir"}
        </p>
      </div>
    </div>
  );
}

/** Panel de vista previa del turno en construcción (sólo lg+, ver el
 * comentario donde se usa): mismo contenido que el resumen que ya se
 * mostraba en el último paso, pero visible desde el principio del wizard y
 * completándose en vivo a medida que el comercio avanza. */
function WizardPreview({
  className,
  position,
  quantity,
  startAt,
  endAt,
  payAmount,
  tips,
  meal,
  urgent,
  dressCode,
  city,
}: {
  className?: string;
  position: WorkerSkill | null;
  quantity: number;
  startAt: string;
  endAt: string;
  payAmount: string;
  tips: boolean;
  meal: boolean;
  urgent: boolean;
  dressCode: string;
  city: string;
}) {
  const positionAccent = position ? SKILL_ACCENT[position] : null;
  const when =
    startAt && endAt
      ? formatShiftRange(localInputToArgentinaISO(startAt), localInputToArgentinaISO(endAt))
      : null;
  const pay = Number(payAmount) > 0 ? `ARS ${Number(payAmount).toLocaleString("es-AR")}` : null;

  return (
    <div className={className}>
      <div className="sticky top-24 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-line">
        <p className="font-display text-lg font-semibold text-ink">Vista previa</p>
        <p className="mt-1 text-sm text-ink/50">Así se va armando el turno.</p>

        <div className="mt-5 flex flex-col gap-4">
          <PreviewRow
            icon={
              positionAccent ? (
                <positionAccent.Icon size={18} className={positionAccent.fg} />
              ) : (
                <UsersIcon size={18} />
              )
            }
            label="Puesto"
            value={position ? `${SKILL_LABELS[position]} · ${quantity} persona` : null}
          />
          <PreviewRow icon={<CalendarIcon size={18} />} label="Cuándo" value={when} />
          <PreviewRow
            icon={<WalletIcon size={18} />}
            label="Pago"
            value={
              pay
                ? `${pay}${tips ? " · con propinas" : ""}${meal ? " · con comida" : ""}${urgent ? " · Urgente" : ""}`
                : null
            }
          />
          <PreviewRow icon={<MapPinIcon size={18} />} label="Dónde" value={city || null} />
        </div>

        {dressCode && (
          <p className="mt-5 rounded-2xl bg-white px-3.5 py-2.5 text-sm text-ink/70 ring-1 ring-line">
            Dress code: {dressCode}
          </p>
        )}

        {urgent && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-primary-text">
            <FlameIcon size={13} className="text-danger-text" /> Se muestra como urgente en el feed
          </p>
        )}
      </div>
    </div>
  );
}
