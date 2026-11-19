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
import { SKILL_ACCENT, SKILL_HERO_TONE, heroInk } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatDuration, formatShiftWhenLive, shiftDurationMinutes } from "@/lib/datetime";
import { formatMoney, payPerHour, payView } from "@/lib/pay";
import TurnoNoDisponible from "@/components/TurnoNoDisponible";
import ShareShiftButton from "@/components/ShareShiftButton";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { useLiveRefresh } from "@/lib/live-refresh";
import { Badge, Comanda, ComandaFila, Skeleton, textoCartel, useToast } from "@/components/ui";
import Filete from "@/components/landing/Filete";
import { LETRAS_APP } from "@/lib/letras";
import DrawnCheck from "@/components/ui/DrawnCheck";
import { loginHref, registerHref } from "@/lib/safe-next";
import { reportShiftHref } from "@/lib/support-reference";
import { shiftHeroPhoto } from "@/lib/company-photo";
import {
  ChevronLeftIcon,
  FileTextIcon,
  RouteIcon,
  ShieldIcon,
  SparklesIcon,
  UtensilsIcon,
  WalletIcon,
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
  const { Icon } = SKILL_ACCENT[shift.position];
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

  return (
    <div className={`${LETRAS_APP} app-container-reading pb-10 md:px-4 md:pt-6`}>
      {/* Cabecera: foto del local o el tono del rubro — el MISMO de la tarjeta
          del feed y del panel (`SKILL_HERO_TONE`). Antes era verde bosque para
          todos los puestos: el bartender se veía vino en la tarjeta y verde al
          abrirlo, así que la identidad que arma la tarjeta se perdía justo en
          el paso siguiente. El color de marca queda para el bloque del pago, que es la
          superficie destacada de la pantalla (v5.0). */}
      <header
        className={`relative h-[240px] overflow-hidden md:rounded-[var(--radius-card)] ${!photo && SKILL_HERO_TONE[shift.position] === "bg-brand" ? "bg-glow" : SKILL_HERO_TONE[shift.position]}`}
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
          <Icon size={190} className={`absolute -right-8 -top-4 ${heroInk(shift.position, false).mark}`} aria-hidden />
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

      {/* El turno como comanda de papel (dirección «con relieve», Julieta
          2026-11-19): montada sobre el borde de la foto, con el puesto en
          brocha, los datos en renglones y el pago como último renglón, con el
          número grande. Antes, título en serif, datos con íconos en mosaico y
          el pago en una banda celeste aparte. Al postularse recibe la cinta
          «¡Oído!». Es el objeto con relieve de la pantalla. */}
      <div className="relative z-[1] -mt-14 px-4 md:-mt-16 md:px-8">
        <Comanda as="section" aria-label="El turno">
          {/* Con la cinta, el papel deja lugar abajo para que no tape el
              renglón del pago. */}
          <div className={`px-4 pt-4 ${apply === "applied" ? "pb-14" : "pb-3"}`}>
            {/* Señales: lo que cambia la decisión, antes que el puesto. */}
            {(shift.urgent || shift.pay_band === "por_encima" || shift.company_verified) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {shift.urgent && <span className="sello-goma sello-rojo">Urgente</span>}
                {shift.company_verified && (
                  <Badge tone="trust" icon={<ShieldIcon size={11} />}>
                    Comercio verificado
                  </Badge>
                )}
                {shift.pay_band === "por_encima" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-text">
                    <SparklesIcon size={12} /> Paga por encima de lo típico
                  </span>
                )}
              </div>
            )}

            <h1 className="letra-cartel letra-cartel-puesto break-words">{textoCartel(label)}</h1>
            {(shift.company_name || shift.city) && (
              <p className="mt-1 text-sm text-ink-soft">
                {[shift.company_name, shift.city].filter(Boolean).join(" · ")}
              </p>
            )}

            <dl className="mt-3">
              <ComandaFila rotulo="Cuándo">
                {formatShiftWhenLive(shift)}
                {minutes != null && pay.kind !== "por_hora" && (
                  <span className="font-medium text-ink-soft"> · {formatDuration(minutes)}</span>
                )}
              </ComandaFila>
              <ComandaFila rotulo="Dónde">{where ?? "Zona a confirmar"}</ComandaFila>
              {shift.quantity != null && shift.quantity > 1 && (
                <ComandaFila rotulo="Personas">{shift.quantity}</ComandaFila>
              )}
              {/* El pago, último renglón y el más grande: es el dato que más
                  pesa para decidir (Julieta eligió que vaya en la comanda y no
                  en una banda aparte). */}
              {/* Si el monto no entra al lado del rótulo (un $ 1.250.000 a
                  320 px casi pisaba «Pago», revisión del 2026-11-19), baja
                  entero al renglón de abajo, a la derecha. */}
              <div className="comanda-fila flex-wrap items-baseline">
                <dt>Pago</dt>
                <dd className="ml-auto max-w-full shrink-0">
                  <span className="text-price font-extrabold tracking-tight">{pay.amount}</span>
                  {pay.suffix && <span className="ml-1.5 text-body font-bold">{pay.suffix}</span>}
                  {/* Turno reofrecido (U080): el número ya es por hora (o el
                      monto que quedó fijo al llegar), y la línea lo explica. */}
                  {(shift.tips || pay.note || perHour) && (
                    <span className="block text-sm font-medium text-ink-soft">
                      {[
                        shift.tips ? "+ propinas" : null,
                        pay.note ?? (perHour ? `≈ ${formatMoney(perHour, shift.currency)} por hora` : null),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {/* Postulado: la cinta «¡Oído!» pegada sobre el papel, como en la
              cocina cuando se canta el pedido. Se pega con un golpe sólo si
              la postulación pasó en esta pantalla (y sin movimiento si así lo
              pide el sistema); si ya estaba hecha al cargar, ya está pegada. */}
          {apply === "applied" && (
            <div aria-hidden className={`cinta-oido${justApplied && !reducedMotion ? " cinta-oido-pega" : ""}`}>
              <Filete palabra="¡Oído!" tam="cinta" className="block h-auto w-full" />
            </div>
          )}
        </Comanda>
      </div>

      <div className="px-4 md:px-0">
        {/* Acción. Con la cinta colgando del papel, un poco más de aire. */}
        <div className={apply === "applied" ? "mt-9" : "mt-5"}>
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
              className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-relieve)] bg-card text-sm font-semibold text-ink ring-1 ring-line"
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
              className="text-sm font-semibold text-ink/50 underline-offset-2 hover:text-ink hover:underline"
            >
              Reportar un problema
            </Link>
          )}
        </div>
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
