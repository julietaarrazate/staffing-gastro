"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { getErrorMessage } from "@/lib/errors";
import { SKILL_LABELS, Shift, ShiftPublic } from "@/lib/types";
import { SKILL_ACCENT, SKILL_HERO_TONE } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatDuration, formatShiftWhen, shiftDurationMinutes } from "@/lib/datetime";
import { formatPayAmount, payPerHour } from "@/lib/pay";
import MiniMap from "@/components/MiniMap";
import ShareShiftButton from "@/components/ShareShiftButton";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { Skeleton, useToast } from "@/components/ui";
import DrawnCheck from "@/components/ui/DrawnCheck";
import { shiftHeroPhoto } from "@/lib/company-photo";
import {
  ChevronLeftIcon,
  ClockIcon,
  FileTextIcon,
  FlameIcon,
  MapPinIcon,
  RouteIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  UtensilsIcon,
  WalletIcon,
} from "@/components/icons";

/** Lo que sabemos del turno: siempre la vista pública (la trae el servidor,
 *  sin sesión) y, si hay sesión, el turno completo encima. */
type Detail = ShiftPublic & Partial<Shift>;

type ApplyState = "unknown" | "can_apply" | "applying" | "applied";

/**
 * Detalle de un turno (`/turno/[id]`), con la composición del board: cabecera
 * con la foto del local (o verde bosque con el ícono del rubro, igual que la
 * tarjeta "Recomendado" del home), título en serif, datos con íconos, pago y
 * la acción.
 *
 * Es la misma URL para dos públicos:
 * - **Sin sesión** (llegó por un link de WhatsApp): la vista pública que arma
 *   el servidor, y "Postulate en Oído" lleva al registro.
 * - **Con sesión**: se pide el turno completo (`GET /shifts/{id}`, que para
 *   un trabajador ya no trae datos de otras personas) para sumar descripción,
 *   condiciones, mapa y "Cómo llegar", y la acción pasa a ser postularse de
 *   verdad. Antes esta página le decía "registrate" a alguien ya logueado,
 *   que llegaba acá tocando un turno del home.
 */
export default function ShiftDetail({ publicShift }: { publicShift: ShiftPublic }) {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const toast = useToast();
  const { requestOptIn } = usePushPrompt();
  const { keyFor, clear } = useIdempotencyKeys();
  const [full, setFull] = useState<Shift | null>(null);
  const [apply, setApply] = useState<ApplyState>("unknown");
  // Sólo se festeja la postulación que pasa en esta pantalla, no la que ya
  // estaba hecha al cargar (ver DrawnCheck).
  const [justApplied, setJustApplied] = useState(false);
  const reducedMotion = useReducedMotion();
  const [photoBroken, setPhotoBroken] = useState(false);
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);

  const isWorker = user?.role === "worker";

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    api
      .get<Shift>(`/shifts/${publicShift.id}`, token)
      .then((shift) => !cancelled && setFull(shift))
      .catch(() => {
        // Sin el turno completo, la vista pública alcanza: no es un error
        // que haya que mostrarle a nadie.
      });
    if (user.role === "employer") {
      api
        .get<{ id: string }>("/companies/me/profile", token)
        .then((company) => !cancelled && setMyCompanyId(company.id))
        .catch(() => {});
    }
    if (user.role === "worker") {
      api
        .get<{ shift_id: string }[]>("/applications/mine?limit=100", token)
        .then((mine) => {
          if (cancelled) return;
          setApply(mine.some((a) => a.shift_id === publicShift.id) ? "applied" : "can_apply");
        })
        .catch(() => !cancelled && setApply("can_apply"));
    }
    return () => {
      cancelled = true;
    };
  }, [token, user, publicShift.id]);

  const shift: Detail = { ...publicShift, ...(full ?? {}) };
  const { Icon } = SKILL_ACCENT[shift.position];
  const label = SKILL_LABELS[shift.position];
  const heroPhoto = shiftHeroPhoto(shift);
  const photo = heroPhoto && !photoBroken ? heroPhoto : null;
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const perHour = payPerHour(shift);
  const isOwner = Boolean(full && myCompanyId && full.company_id === myCompanyId);
  const hasCoords = shift.latitude != null && shift.longitude != null;
  const where = shift.address ? [shift.address, shift.city].filter(Boolean).join(", ") : shift.city;

  async function onApply() {
    if (!token) return;
    setApply("applying");
    try {
      await api.post(`/applications/shifts/${shift.id}`, undefined, token, undefined, keyFor(shift.id));
      clear(shift.id);
      setJustApplied(true);
      setApply("applied");
      toast("¡Te postulaste! El comercio ya te puede ver");
      // La invitación a notificaciones espera a que se vea la confirmación
      // (el check se dibuja en ~0,5 s): si sale junto, su hoja la tapa.
      window.setTimeout(requestOptIn, reducedMotion ? 0 : 1200);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clear(shift.id);
        setApply("applied");
        return;
      }
      setApply("can_apply");
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
    }
  }

  return (
    <div className="app-container-reading pb-10 md:px-4 md:pt-6">
      {/* Cabecera: foto del local o el tono del rubro — el MISMO de la tarjeta
          del feed y del panel (`SKILL_HERO_TONE`). Antes era verde bosque para
          todos los puestos: el bartender se veía vino en la tarjeta y verde al
          abrirlo, así que la identidad que arma la tarjeta se perdía justo en
          el paso siguiente. El verde queda para el bloque del pago, que es la
          superficie destacada de la pantalla (v5.0). */}
      <header
        className={`relative h-[240px] overflow-hidden md:rounded-[var(--radius-card)] ${SKILL_HERO_TONE[shift.position]}`}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb) */}
            <img
              src={cldThumb(photo, 900)}
              alt=""
              onError={() => setPhotoBroken(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/30" />
          </>
        ) : (
          <Icon size={190} className="absolute -right-8 -top-4 text-white/10" aria-hidden />
        )}

        <div className="relative flex items-start justify-between p-4">
          {user ? (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
              aria-label="Volver"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-night shadow-sm"
            >
              <ChevronLeftIcon size={20} />
            </button>
          ) : (
            <span />
          )}
          {isWorker && <SaveShiftButton shiftId={shift.id} />}
        </div>
      </header>

      <div className="relative -mt-6 rounded-t-[1.5rem] bg-background px-4 pt-5 md:mt-0 md:rounded-none md:px-0">
        {/* Señales: lo que cambia la decisión, antes que el título. */}
        {(shift.urgent || shift.pay_band === "por_encima" || shift.company_verified) && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {shift.urgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2.5 py-1 text-xs font-bold text-danger-text">
                <FlameIcon size={12} /> Urgente
              </span>
            )}
            {shift.pay_band === "por_encima" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary-text">
                <SparklesIcon size={12} /> Paga por encima de lo típico
              </span>
            )}
            {shift.company_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-text">
                <ShieldIcon size={12} /> Comercio verificado
              </span>
            )}
          </div>
        )}

        <h1 className="font-display text-h1 font-medium text-ink">{label}</h1>
        {(shift.company_name || shift.city) && (
          <p className="mt-0.5 text-body text-ink/60">
            {[shift.company_name, shift.city].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Datos con íconos: cuándo, cuánto dura, dónde. */}
        <dl className="mt-5 space-y-3">
          <InfoRow icon={<ClockIcon size={18} />} label="Cuándo">
            {formatShiftWhen(shift.start_at, shift.end_at)}
            {minutes != null && <span className="text-ink/50"> · {formatDuration(minutes)}</span>}
          </InfoRow>
          <InfoRow icon={<MapPinIcon size={18} />} label="Dónde">
            {where ?? "Zona a confirmar"}
          </InfoRow>
          {shift.quantity != null && shift.quantity > 1 && (
            <InfoRow icon={<UsersIcon size={18} />} label="Personas">
              {shift.quantity}
            </InfoRow>
          )}
        </dl>

        {/* Pago: la masa de color de la pantalla, en el verde de la marca. */}
        <section
          aria-label="Pago"
          className="mt-5 flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-secondary px-4 py-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Pago</p>
            <p className="text-price font-extrabold tracking-tight text-white">
              {formatPayAmount(shift)}
            </p>
            <p className="text-sm text-white/75">
              {[shift.tips ? "+ propinas" : null, perHour ? `≈ ${formatPayAmount({ pay_amount: String(Math.round(perHour)), currency: shift.currency })} por hora` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-night">
            <WalletIcon size={20} />
          </span>
        </section>

        {/* Acción. */}
        <div className="mt-5">
          <PrimaryAction
            loading={loading || (isWorker && apply === "unknown")}
            loggedIn={Boolean(user)}
            isWorker={isWorker}
            isOwner={isOwner}
            shiftId={shift.id}
            apply={apply}
            justApplied={justApplied}
            onApply={onApply}
          />
        </div>

        {/* Condiciones: van también sin sesión — es con lo que alguien que
            llega por WhatsApp decide si le conviene registrarse. */}
        {(shift.meal || shift.tips || shift.dress_code) && (
          <section className="mt-7">
            <h2 className="text-h3 font-semibold text-ink">Qué incluye</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {shift.tips && <Chip icon={<WalletIcon size={14} />}>Propinas</Chip>}
              {shift.meal && <Chip icon={<UtensilsIcon size={14} />}>Comida del personal</Chip>}
              {shift.dress_code && <Chip icon={<FileTextIcon size={14} />}>Vestimenta: {shift.dress_code}</Chip>}
            </div>
          </section>
        )}

        {full?.description && (
          <section className="mt-7">
            <h2 className="text-h3 font-semibold text-ink">Sobre el turno</h2>
            <p className="mt-2 whitespace-pre-line text-body leading-relaxed text-ink/75">{full.description}</p>
          </section>
        )}

        {hasCoords && (
          <section className="mt-7">
            <h2 className="text-h3 font-semibold text-ink">Ubicación</h2>
            <div className="mt-2.5 overflow-hidden rounded-2xl ring-1 ring-line">
              <MiniMap latitude={shift.latitude!} longitude={shift.longitude!} className="h-40 w-full" />
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-card text-sm font-semibold text-ink ring-1 ring-line"
            >
              <RouteIcon size={18} /> Cómo llegar
            </a>
          </section>
        )}

        <div className="mt-7 flex justify-center border-t border-line pt-4">
          <ShareShiftButton shift={shift} shiftId={shift.id} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-ink/70">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-ink/50">{label}</dt>
        <dd className="text-body font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm text-ink/80">
      <span className="text-ink/55">{icon}</span>
      {children}
    </span>
  );
}

const PRIMARY_BUTTON =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-primary px-6 text-base font-bold text-night shadow-[var(--shadow-primary)] transition active:scale-[0.98] disabled:opacity-70";

function PrimaryAction({
  loading,
  loggedIn,
  isWorker,
  isOwner,
  shiftId,
  apply,
  justApplied,
  onApply,
}: {
  loading: boolean;
  loggedIn: boolean;
  isWorker: boolean;
  isOwner: boolean;
  shiftId: string;
  apply: ApplyState;
  justApplied: boolean;
  onApply: () => void;
}) {
  const reducedMotion = useReducedMotion();
  if (loading) return <Skeleton className="h-14 w-full rounded-[var(--radius-btn)]" />;

  if (!loggedIn) {
    // Quien llega por un link compartido casi siempre es un trabajador: se
    // preselecciona su rol en el registro (mismo patrón que la landing).
    return (
      <>
        <Link href="/register?rol=trabajador" className={PRIMARY_BUTTON}>
          Postulate en Oído
        </Link>
        <p className="mt-2.5 text-center text-xs text-ink/45">
          Creá tu perfil gratis y postulate a este y otros turnos gastronómicos.
        </p>
      </>
    );
  }

  if (isWorker) {
    // El botón se convierte en la confirmación: sale achicándose y entra el
    // panel verde con el check que se dibuja. `initial={false}`: si al cargar
    // ya estaba postulado, el panel aparece quieto.
    const swap = reducedMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
        };
    return (
      <AnimatePresence mode="wait" initial={false}>
        {apply === "applied" ? (
          <motion.div
            key="applied"
            {...swap}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-[var(--radius-card)] bg-success-tint px-4 py-3.5"
          >
            <DrawnCheck size={24} animate={justApplied} className="shrink-0 text-success-text" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink">Ya te postulaste</p>
              <p className="text-sm text-ink/60">Te avisamos cuando el comercio responda.</p>
            </div>
            <Link href="/my-shifts" className="shrink-0 text-sm font-semibold text-primary-text">
              Ver
            </Link>
          </motion.div>
        ) : (
          <motion.button
            key="apply"
            {...swap}
            transition={{ duration: 0.15, ease: "easeIn" }}
            type="button"
            onClick={onApply}
            disabled={apply === "applying"}
            className={PRIMARY_BUTTON}
          >
            {apply === "applying" ? "Enviando…" : "Postularme"}
          </motion.button>
        )}
      </AnimatePresence>
    );
  }

  if (isOwner) {
    return (
      <Link href={`/shifts/${shiftId}/candidates`} className={PRIMARY_BUTTON}>
        Ver postulantes
      </Link>
    );
  }

  return null;
}
