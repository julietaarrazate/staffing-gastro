"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { appliedShiftIds, unassignedShiftIds } from "@/lib/applications";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { getErrorMessage } from "@/lib/errors";
import { SKILL_LABELS, Shift, ShiftApplication, ShiftPublic } from "@/lib/types";
import { cldThumb } from "@/lib/cloudinary";
import {
  formatDuration,
  formatShiftWhenLive,
  franjaDelDia,
  shiftDurationMinutes,
} from "@/lib/datetime";
import { formatMoney, payPerHour, payView } from "@/lib/pay";
import TurnoNoDisponible from "@/components/TurnoNoDisponible";
import ShareShiftButton from "@/components/ShareShiftButton";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { useLiveRefresh } from "@/lib/live-refresh";
import { Skeleton, useToast } from "@/components/ui";
import { LETRA_TITULOS, LETRAS_APP } from "@/lib/letras";
import DrawnCheck from "@/components/ui/DrawnCheck";
import { loginHref, registerHref } from "@/lib/safe-next";
import { reportShiftHref } from "@/lib/support-reference";
import { shiftHeroPhoto } from "@/lib/company-photo";
import {
  ChevronLeftIcon,
  FlameIcon,
  MoonIcon,
  RouteIcon,
  ShieldIcon,
  SparklesIcon,
  SunIcon,
} from "@/components/icons";

// maplibre pesa ~286 KB comprimidos: el mapa chico se carga aparte, como en
// `ShiftCard` (medido 2026-10-22, ver historial).
const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse bg-surface" />,
});

/** Lo que sabemos del turno: siempre la vista pública (la trae el servidor,
 *  sin sesión) y, si hay sesión, el turno completo encima. */
type Detail = ShiftPublic & Partial<Shift>;

// `released`: tuvo este turno asignado y lo dejó (G4). No se postula otra vez:
// sigue en la lista del comercio, que decide si lo vuelve a elegir.
type ApplyState = "unknown" | "can_apply" | "applying" | "applied" | "released";
// Comienzo del 409 de `POST /applications/shifts/{id}` para quien tuvo el
// turno y lo dejó (`backend/app/modules/application/api/routes.py`).
const ALREADY_UNASSIGNED_PREFIX = "Ya tuviste este turno asignado";

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
  // El servidor contestó 404 al pedir el turno completo: quien no es parte ya
  // no lo ve (se cubrió, se canceló o venció). Se muestra el aviso en lugar de
  // seguir ofreciendo «Postularme» (VIE-03).
  const [gone, setGone] = useState(false);
  const applyRef = useRef<ApplyState>("unknown");
  useLayoutEffect(() => {
    applyRef.current = apply;
  });
  // Sólo se festeja la postulación que pasa en esta pantalla, no la que ya
  // estaba hecha al cargar (ver DrawnCheck).
  const [justApplied, setJustApplied] = useState(false);
  const reducedMotion = useReducedMotion();
  const [photoBroken, setPhotoBroken] = useState(false);
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);

  const isWorker = user?.role === "worker";

  // El turno completo y, para el trabajador, si ya se postuló. Es lo que cambia
  // por fuera de esta pantalla (el comercio cancela, lo cubre otra persona), así
  // que también lo vuelve a pedir `useLiveRefresh` más abajo. `silent`: si falla
  // no se toca nada de lo que ya se ve.
  // Último pedido gana, y se cancela al cambiar de turno o desmontar: una
  // respuesta vieja no pisa a una más nueva ni al turno de otra pantalla.
  const latestLoad = useRef(0);
  // Cuenta las veces que la persona se postuló (o empezó a hacerlo): una
  // respuesta que salió antes nunca baja un «applied»/«applying» a «can_apply».
  const applyEpoch = useRef(0);
  useEffect(() => {
    const current = latestLoad;
    return () => {
      current.current += 1;
    };
  }, [publicShift.id]);
  // La primera carga terminó (bien o mal). Hasta entonces las recargas por
  // avisos esperan: una silenciosa que fallara tras descartar a la primera
  // dejaría `apply` en «unknown» (esqueleto del botón) para siempre.
  const [loadedOnce, setLoadedOnce] = useState(false);
  const loadState = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!token || !user) return;
      const mine = ++latestLoad.current;
      const epoch = applyEpoch.current;
      let notFound = false; // el servidor dijo 404 al pedir el turno completo
      let isParty = false; // y la lista de postulaciones dice que es parte
      const tasks: Promise<unknown>[] = [
        api
          .get<Shift>(`/shifts/${publicShift.id}`, token)
          .then((shift) => {
            if (mine !== latestLoad.current) return;
            setFull(shift);
            setGone(false);
          })
          .catch((err) => {
            // 404: ya no está disponible para esta persona (se resuelve abajo,
            // cuando también se sabe si es parte). Cualquier otro error: sin el
            // turno completo, la vista pública alcanza, no hay nada que
            // mostrarle a nadie.
            if (err instanceof ApiError && err.status === 404) notFound = true;
          }),
      ];
      if (user.role === "worker") {
        tasks.push(
          api
            .get<ShiftApplication[]>("/applications/mine?limit=100", token)
            .then((mine_) => {
              if (mine !== latestLoad.current) return;
              const applied = appliedShiftIds(mine_).has(publicShift.id);
              const released = unassignedShiftIds(mine_).has(publicShift.id);
              isParty = applied || released;
              setApply((prev) => {
                // Se postuló (o está postulándose) después de que salió este
                // pedido: la lista que trae puede no incluirla todavía.
                if (epoch !== applyEpoch.current || prev === "applying") return prev;
                if (released) return "released";
                return applied ? "applied" : "can_apply";
              });
            })
            .catch(() => {
              if (!silent && mine === latestLoad.current) {
                setApply((prev) => (prev === "unknown" ? "can_apply" : prev));
              }
            })
        );
      }
      await Promise.all(tasks);
      // Quien se postuló es parte y lo sigue viendo: ahí un 404 no puede ser
      // «ya no está». Para el resto, sí.
      if (
        notFound &&
        !isParty &&
        mine === latestLoad.current &&
        applyRef.current !== "applied" &&
        applyRef.current !== "released"
      ) {
        setGone(true);
      }
    },
    [token, user, publicShift.id]
  );

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    if (user.role === "employer") {
      api
        .get<{ id: string }>("/companies/me/profile", token)
        .then((company) => !cancelled && setMyCompanyId(company.id))
        .catch(() => {});
    }
    setLoadedOnce(false);
    void loadState().finally(() => !cancelled && setLoadedOnce(true));
    return () => {
      cancelled = true;
    };
  }, [token, user, loadState]);

  // Al día con los avisos (G1, U013): si el comercio canceló o lo cubrió otra
  // persona mientras mirabas el turno, se ve sin recargar. En pausa mientras se
  // envía la postulación.
  useLiveRefresh(loadState, { paused: apply === "applying" || !loadedOnce });

  const shift: Detail = { ...publicShift, ...(full ?? {}) };
  const label = SKILL_LABELS[shift.position];
  const heroPhoto = shiftHeroPhoto(shift);
  const photo = heroPhoto && !photoBroken ? heroPhoto : null;
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const perHour = payPerHour(shift);
  const pay = payView(shift);
  const isOwner = Boolean(full && myCompanyId && full.company_id === myCompanyId);
  const hasCoords = shift.latitude != null && shift.longitude != null;
  const where = shift.address ? [shift.address, shift.city].filter(Boolean).join(", ") : shift.city;

  async function onApply() {
    if (!token) return;
    applyEpoch.current += 1;
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
        // Con la pestaña vieja, el 409 puede ser «Ya tuviste este turno
        // asignado» (G4), no «Ya te postulaste»: lo distingue el servidor.
        setApply(err.message.startsWith(ALREADY_UNASSIGNED_PREFIX) ? "released" : "applied");
        return;
      }
      setApply("can_apply");
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
      // Con la pantalla vieja el error suele ser «ya no está»: se relee para
      // que la pantalla diga lo que pasó en lugar de seguir ofreciendo el botón.
      void loadState({ silent: true });
    }
  }

  if (gone) return <TurnoNoDisponible />;

  const franja = franjaDelDia(shift.start_at);
  const lugar = [shift.company_name, shift.city].filter(Boolean).join(" · ");

  return (
    <div className={`${LETRAS_APP} ${LETRA_TITULOS} estilo-suave app-container-reading pb-10 md:px-4 md:pt-6`}>
      {/* PRUEBA (2026-11-19, la propuesta «si fuese mía»): arriba el cielo de
          la hora del turno (de mañana, de tarde o de noche, con estrellas),
          con el puesto en letra grande y los datos en chips; abajo la hoja con
          el turno como ticket: el pago grande, el corte troquelado y los
          renglones. Al postularse, el «¡Oído!» en brocha se pega sobre el
          ticket. La foto del local pasa a la hoja, debajo del ticket. */}
      <header className={`cielo-turno cielo-${franja} px-4 pb-14 pt-4 md:rounded-t-[28px] md:px-8`}>
        {franja === "noche" ? (
          <div aria-hidden className="estrellas" />
        ) : (
          <>
            <div aria-hidden className="nube" style={{ width: 220, height: 70, left: -60, top: 110 }} />
            <div aria-hidden className="nube" style={{ width: 180, height: 60, right: -40, top: 40 }} />
          </>
        )}
        <div className="flex items-start justify-between">
          {user ? (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
              aria-label="Volver"
              className="boton-vidrio h-10 w-10"
            >
              <ChevronLeftIcon size={20} />
            </button>
          ) : (
            <span />
          )}
          {isWorker && <SaveShiftButton shiftId={shift.id} />}
        </div>

        {/* Señales: lo que cambia la decisión, antes que el puesto. */}
        {(shift.urgent || shift.pay_band === "por_encima" || shift.company_verified) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {shift.urgent && (
              <span className="chip-vidrio">
                <FlameIcon size={14} /> Urgente
              </span>
            )}
            {shift.company_verified && (
              <span className="chip-vidrio">
                <ShieldIcon size={13} /> Comercio verificado
              </span>
            )}
            {shift.pay_band === "por_encima" && (
              <span className="chip-vidrio">
                <SparklesIcon size={13} /> Paga más que lo típico
              </span>
            )}
          </div>
        )}

        {lugar && <p className="mt-5 text-sm font-semibold opacity-85">{lugar}</p>}
        <h1 className="titulo-turno mt-1 break-words">{label}</h1>
        {/* Cuándo, una sola vez: en palabras («Mañana · 21:00 – 02:00», «Ya
            empezó…») y con la duración. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip-vidrio">
            {franja === "noche" ? <MoonIcon size={14} /> : <SunIcon size={14} />}
            {formatShiftWhenLive(shift)}
            {minutes != null && pay.kind !== "por_hora" && ` · ${formatDuration(minutes)}`}
          </span>
        </div>
      </header>

      <div className="hoja -mt-8 px-4 pb-4 pt-8 md:px-8">
        <section aria-label="El turno" className="ticket">
          {apply === "applied" && (
            <span aria-hidden className={`sello-oido${justApplied && !reducedMotion ? " sello-oido-pega" : ""}`}>
              ¡OÍDO!
            </span>
          )}
          <div className="px-5 pb-4 pt-5">
            <p className="text-sm font-semibold text-ink-soft">{pay.suffix ? "Pago" : "Pago por la jornada"}</p>
            <p className="mt-1 text-ink">
              <span className="plata text-display">{pay.amount}</span>
              {pay.suffix && <span className="ml-1.5 text-body font-bold">{pay.suffix}</span>}
            </p>
            {(shift.tips || pay.note || perHour) && (
              <p className="mt-1.5 text-sm font-medium text-ink-soft">
                {[
                  pay.note ?? (perHour ? `≈ ${formatMoney(perHour, shift.currency)} por hora` : null),
                  shift.tips ? "+ propinas" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div aria-hidden className="ticket-corte" />
          <dl className="ticket-renglones px-5 pt-4">
            <dt>Dónde</dt>
            <dd>{where ?? "Zona a confirmar"}</dd>
            {shift.quantity != null && shift.quantity > 1 && (
              <>
                <dt>Personas</dt>
                <dd>{shift.quantity}</dd>
              </>
            )}
          </dl>
          {(shift.meal || shift.tips || shift.dress_code) ? (
            <div className="px-5 pb-5 pt-3">
              <p className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">Qué incluye</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shift.tips && <span className="chip-suave">Propinas</span>}
                {shift.meal && <span className="chip-suave">Comida del personal</span>}
                {shift.dress_code && <span className="chip-suave">Vestimenta: {shift.dress_code}</span>}
              </div>
            </div>
          ) : (
            <div className="pb-5" />
          )}
        </section>

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

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb)
          <img
            src={cldThumb(photo, 900)}
            alt=""
            decoding="async"
            onError={() => setPhotoBroken(true)}
            className="mt-6 h-44 w-full rounded-[20px] object-cover"
          />
        )}

        {full?.description && (
          <section className="mt-7">
            <h2 className="text-h3 font-bold text-ink">Sobre el turno</h2>
            <p className="mt-2 whitespace-pre-line text-body leading-relaxed text-ink-soft">{full.description}</p>
          </section>
        )}

        {hasCoords && (
          <section className="mt-7">
            <h2 className="text-h3 font-bold text-ink">Ubicación</h2>
            <div className="mt-2.5 overflow-hidden rounded-[20px]">
              <MiniMap latitude={shift.latitude!} longitude={shift.longitude!} className="h-40 w-full" />
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tecla mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 text-sm font-semibold text-ink"
            >
              <RouteIcon size={18} /> Cómo llegar
            </a>
          </section>
        )}

        <div className="mt-7 flex flex-col items-center gap-3 border-t border-line pt-4">
          <ShareShiftButton shift={shift} shiftId={shift.id} />
          {/* U110: discreto, sin acento. Sólo un trabajador con sesión puede
              atar el turno a un ticket. */}
          {isWorker && (
            <Link
              href={reportShiftHref(shift.id)}
              className="text-sm font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              Reportar un problema
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const PRIMARY_BUTTON =
  "flex min-h-[56px] w-full items-center justify-center gap-2 boton-relieve bg-primary px-6 text-base font-bold text-night disabled:opacity-70";

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
  if (loading) return <Skeleton className="h-14 w-full rounded-[var(--radius-relieve)]" />;

  if (!loggedIn) {
    // Quien llega por un link compartido casi siempre es un trabajador: se
    // preselecciona su rol en el registro (mismo patrón que la landing). Tanto
    // el alta como el ingreso vuelven a este turno (`next`, U062).
    const aca = `/turno/${shiftId}`;
    return (
      <>
        <Link href={registerHref({ rol: "trabajador", next: aca })} className={PRIMARY_BUTTON}>
          Postulate en Oído
        </Link>
        <p className="mt-2.5 text-center text-xs text-ink/45">
          Creá tu perfil gratis y postulate a este y otros turnos gastronómicos.
        </p>
        <p className="mt-2 text-center text-sm text-ink/70">
          ¿Ya tenés cuenta?{" "}
          <Link href={loginHref({ next: aca })} className="font-semibold text-primary-text">
            Ingresá
          </Link>
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
        {apply === "released" ? (
          <motion.div
            key="released"
            {...swap}
            transition={{ duration: 0.18, ease: "easeOut" }}
            data-testid="turno-ya-asignado-antes"
            className="rounded-[var(--radius-card)] bg-surface px-4 py-3.5 ring-1 ring-line"
          >
            <p className="text-body font-semibold text-ink">Ya tuviste este turno asignado</p>
            <p className="text-sm text-ink/60">Si el comercio te vuelve a elegir, te avisamos.</p>
          </motion.div>
        ) : apply === "applied" ? (
          <motion.div
            key="applied"
            {...swap}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-[20px] bg-[var(--suave-campo)] px-4 py-4"
          >
            {/* Lo que sigue, para que quien espera sepa en qué está. */}
            <ol className="flex flex-col gap-2.5">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-text text-card">
                  <DrawnCheck size={18} animate={justApplied} />
                </span>
                <span className="text-body font-bold text-ink">Ya te postulaste</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_2px_var(--color-primary-text)]">
                  <span className="h-2 w-2 rounded-full bg-primary-text" />
                </span>
                <span className="text-body font-semibold text-ink">
                  El comercio elige <span className="font-medium text-ink-soft">· te avisamos</span>
                </span>
              </li>
              <li className="flex items-center gap-3 text-ink-soft">
                <span className="h-7 w-7 shrink-0 rounded-full shadow-[inset_0_0_0_2px_currentColor]" />
                <span className="text-body font-semibold">Confirmás y vas</span>
              </li>
            </ol>
            <Link href="/my-shifts" className="mt-3 inline-block text-sm font-semibold text-primary-text">
              Ver mis turnos
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
