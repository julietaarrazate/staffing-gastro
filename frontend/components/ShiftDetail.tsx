"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { enviarPostulacion, appliedShiftIds, unassignedShiftIds } from "@/lib/applications";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { getErrorMessage } from "@/lib/errors";
import { SKILL_LABELS, Shift, ShiftApplication, ShiftPublic } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatDuration, formatShiftWhenLive, shiftDurationMinutes } from "@/lib/datetime";
import { formatMoney, payPerHour, payView } from "@/lib/pay";
import TurnoNoDisponible from "@/components/TurnoNoDisponible";
import ShareShiftButton from "@/components/ShareShiftButton";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { useLiveRefresh } from "@/lib/live-refresh";
import { Badge, PortadaCielo, Skeleton, useToast } from "@/components/ui";
import Filete from "@/components/landing/Filete";
import { LETRAS_APP } from "@/lib/letras";
import DrawnCheck from "@/components/ui/DrawnCheck";
import { loginHref, registerHref } from "@/lib/safe-next";
import { avisoPostulacion, estadoPostulado, textoPostularse, useConfirmarPuedoIr } from "@/components/worker/ConfirmarPuedoIr";
import { reportShiftHref } from "@/lib/support-reference";
import { shiftHeroPhoto } from "@/lib/company-photo";
import { comoLlegarHref } from "@/lib/como-llegar";
import {
  ChevronLeftIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
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
/** Hasta qué parte del alto de la ventana puede ocupar la acción pegada. */
const MAX_ACCION_PEGADA = 0.4;

type ApplyState = "unknown" | "can_apply" | "applying" | "applied" | "released";
// Comienzo del 409 de `POST /applications/shifts/{id}` para quien tuvo el
// turno y lo dejó (`backend/app/modules/application/api/routes.py`).
const ALREADY_UNASSIGNED_PREFIX = "Ya tuviste este turno asignado";

/**
 * Detalle de un turno (`/turno/[id]`), con la dirección suave (ADR-0028, «la
 * hoja sobre el cielo»; Julieta, 2026-11-20). La foto del local hace de cielo:
 * arriba, a sangre, con «Volver», «Guardar» y «Compartir» como botones de
 * vidrio. Sin foto, la portada es el cielo (`PortadaCielo`), no el bloque de
 * color por rubro. Debajo sube la hoja: el puesto como título, el pago como el
 * número más grande de la pantalla, cuándo y dónde en filas, y lo que incluye
 * y lo que pide el local. Abajo, fija, la acción: el único ámbar.
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
  const { confirmar, dialogo } = useConfirmarPuedoIr();
  const [full, setFull] = useState<Shift | null>(null);
  const [apply, setApply] = useState<ApplyState>("unknown");
  // La postulación vigente es un ofrecimiento «Puedo ir ya» (carril urgente).
  // Sale de SU postulación (`/applications/mine`) o de lo que confirmó recién.
  const [ofrecido, setOfrecido] = useState(false);
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
  // La foto que falló, por su dirección: si después llega otra (el turno
  // completo puede traer una distinta), esa sí se intenta.
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  // La foto viene en el HTML del servidor: si falla antes de que React
  // enganche `onError`, el evento se pierde. Se mira al montar.
  const photoRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = photoRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBrokenPhoto(img.dataset.foto ?? null);
  }, []);
  // La acción pegada abajo: se despega si ocupa demasiado de la pantalla (con
  // la letra al 200 % llegaba a taparla casi entera), y mientras está pegada
  // el navegador deja ese lugar libre al llevar el foco a algo (teclado).
  const accionRef = useRef<HTMLDivElement>(null);
  const [accionSuelta, setAccionSuelta] = useState(false);
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
              if (epoch === applyEpoch.current) {
                setOfrecido(
                  mine_.some((a) => a.shift_id === publicShift.id && a.status === "pendiente" && a.se_ofrecio_para_ya)
                );
              }
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
  const photo = heroPhoto && heroPhoto !== brokenPhoto ? heroPhoto : null;
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const perHour = payPerHour(shift);
  const pay = payView(shift);
  const isOwner = Boolean(full && myCompanyId && full.company_id === myCompanyId);
  const hasCoords = shift.latitude != null && shift.longitude != null;
  // Sólo con sesión llegan la dirección y las coordenadas (la página pública
  // no las trae): «Cómo llegar» usa las coordenadas o, sin ellas, la dirección.
  const comoLlegar = comoLlegarHref(shift);

  const hayAccion = loading || !user || isWorker || isOwner;

  async function onApply() {
    if (!token) return;
    // Carril urgente: «Puedo ir ya» pregunta antes de postular.
    if (!(await confirmar(shift))) return;
    applyEpoch.current += 1;
    setApply("applying");
    try {
      const enviada = await enviarPostulacion({ token, shift, key: keyFor(shift.id), confirmar });
      if (!enviada) {
        // «Ahora no» en la pregunta que abrió el servidor (pantalla vieja).
        setApply("can_apply");
        return;
      }
      clear(shift.id);
      setJustApplied(true);
      setOfrecido(enviada.ofrecido);
      setApply("applied");
      toast(avisoPostulacion({ apply_commits: enviada.ofrecido }));
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

  const accionVisible = !gone && hayAccion;
  useEffect(() => {
    const barra = accionRef.current;
    if (!accionVisible || !barra) return;
    const html = document.documentElement;
    const medir = () => {
      const alto = barra.offsetHeight;
      const suelta = alto > window.innerHeight * MAX_ACCION_PEGADA;
      setAccionSuelta(suelta);
      const abajo = Number.parseFloat(getComputedStyle(barra).bottom) || 0;
      html.style.scrollPaddingBottom = suelta ? "" : `${Math.round(alto + abajo)}px`;
    };
    medir();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observer?.observe(barra);
    window.addEventListener("resize", medir);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", medir);
      html.style.scrollPaddingBottom = "";
    };
  }, [accionVisible]);

  if (gone) return <TurnoNoDisponible />;

  // La barra de abajo de la app sólo existe con sesión (`BottomNav`), pero el
  // layout le reserva lugar siempre. Sin sesión, la pantalla ocupa ese lugar
  // y la acción queda pegada al borde; con sesión, justo encima de la barra.
  const conBarra = Boolean(user);
  const extras = [
    pay.kind !== "por_hora" && minutes != null ? formatDuration(minutes) : null,
    !pay.note && perHour ? `≈ ${formatMoney(perHour, shift.currency)} por hora` : null,
    shift.tips ? "+ propinas" : null,
  ].filter(Boolean);

  return (
    <div
      // En la compu (lg) el marco se ensancha y la portada pasa a una columna
      // al lado de la hoja; en el celular y la tablet, igual que siempre.
      className={`${LETRAS_APP} estilo-suave mx-auto w-full max-w-[var(--app-reading)] flex flex-col md:mb-0 md:min-h-0 md:px-4 md:pb-10 md:pt-6 lg:grid lg:max-w-[var(--app-frame)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-5 ${
        conBarra
          ? "min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))]"
          : "-mb-[var(--chrome-bottom)] min-h-[calc(100dvh-var(--chrome-top))]"
      }`}
    >
      {/* La portada: la foto del local a sangre o, sin foto, el cielo. Los
          botones son de vidrio blanco en los dos casos y en los dos temas (la
          foto no cambia de noche). */}
      {/* El alto sigue a la pantalla: en un celular bajo la foto no se lleva
          el lugar del puesto y del pago. */}
      <header className="relative h-[clamp(180px,34dvh,300px)] shrink-0 overflow-hidden bg-surface md:h-[clamp(180px,45dvh,340px)] md:rounded-t-[28px] lg:h-auto lg:min-h-[30rem] lg:rounded-[28px]">
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb) */}
            <img
              ref={photoRef}
              src={cldThumb(photo, 900)}
              alt=""
              decoding="async"
              fetchPriority="high"
              data-foto={photo}
              onError={() => setBrokenPhoto(photo)}
              className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
            />
            {/* Un velo arriba, para que los botones se lean sobre una foto clara. */}
            <div aria-hidden className="portada-velo absolute inset-0" />
          </>
        ) : (
          <PortadaCielo id={shift.id} Icon={Icon} iconoEn="centro-izq" nubeEn="medio" />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 md:p-5">
          {user ? (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
              aria-label="Volver"
              className="boton-vidrio sobre-foto h-11 w-11 shrink-0"
            >
              <ChevronLeftIcon size={22} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {isWorker && (
              <SaveShiftButton
                shiftId={shift.id}
                iconSize={20}
                className="boton-vidrio sobre-foto !h-11 !w-11 !shadow-none"
              />
            )}
            <ShareShiftButton shift={shift} shiftId={shift.id} vidrio />
          </div>
        </div>

        {/* Lo que apura la decisión, sobre la foto y arriba del borde de la hoja. */}
        {shift.urgent && (
          <div className="absolute bottom-11 left-5 right-5 flex flex-wrap gap-1.5 lg:bottom-5">
            <span className="chip-foto chip-foto-urgente">Urgente</span>
          </div>
        )}
      </header>

      {/* La hoja. `flex-1` y la acción con `mt-auto`: con poco contenido la
          hoja llega igual hasta abajo y la acción queda en el borde. */}
      <section aria-label="El turno" className="hoja -mt-7 flex flex-1 flex-col px-5 pt-6 md:px-8 md:pt-7 lg:mt-0">
        {/* Postulado: la cinta «¡Oído!» pegada sobre el borde de la hoja, como
            en la cocina cuando se canta el pedido. Se pega con un golpe sólo
            si la postulación pasó en esta pantalla (y sin movimiento si así
            lo pide el sistema); si ya estaba hecha al cargar, ya está pegada. */}
        {apply === "applied" && (
          <div aria-hidden className={`cinta-oido${justApplied && !reducedMotion ? " cinta-oido-pega" : ""}`}>
            <Filete palabra="¡Oído!" tam="cinta" className="block h-auto w-full" />
          </div>
        )}

        <h1 className="titulo-pantalla break-words text-ink">{label}</h1>
        {(shift.company_name || shift.city) && (
          <p className="mt-1 break-words text-fila text-ink-soft">
            {[shift.company_name, shift.city].filter(Boolean).join(" · ")}
          </p>
        )}
        {shift.company_verified && (
          <div className="mt-2">
            <Badge tone="trust" icon={<ShieldIcon size={11} />}>
              Comercio verificado
            </Badge>
          </div>
        )}

        {/* `dl > div > dt + dd`: cada dato es un grupo con su rótulo. */}
        <dl className="mt-5 flex flex-col gap-3.5">
          {/* El pago: el número más grande de la pantalla, entre dos rayas.
              Si no entra al lado de lo que lo explica (un $ 1.250.000 a
              320 px), eso baja al renglón de abajo. */}
          <div className="mb-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-y border-line py-[1.125rem]">
            <dt className="sr-only">Pago</dt>
            <dd className="min-w-0">
              <span className="turno-pago">{pay.amount}</span>
              {pay.suffix && <span className="ml-1.5 text-base font-bold text-ink">{pay.suffix}</span>}
            </dd>
            {extras.length > 0 && (
              <dd className="ml-auto text-right text-sm leading-snug text-ink-soft">
                {extras.map((linea) => (
                  <span key={linea} className="block">
                    {linea}
                  </span>
                ))}
              </dd>
            )}
            {/* Turno reofrecido (U080): el número ya es por hora (o el monto
                que quedó fijo al llegar), y la línea lo explica. */}
            {pay.note && <dd className="basis-full text-sm text-ink-soft">{pay.note}</dd>}
            {shift.pay_band === "por_encima" && (
              <dd className="flex basis-full items-center gap-1 text-xs font-bold text-primary-text">
                <SparklesIcon size={12} /> Paga por encima de lo típico
              </dd>
            )}
          </div>

          <Fila rotulo="Cuándo" icono={<ClockIcon size={20} />} titulo={formatShiftWhenLive(shift)} />
          <Fila
            rotulo="Dónde"
            icono={<MapPinIcon size={20} />}
            titulo={shift.address ?? shift.city ?? "Zona a confirmar"}
            detalle={shift.address ? shift.city : null}
          >
            {comoLlegar && (
              <a
                href={comoLlegar}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary-text"
              >
                Cómo llegar
              </a>
            )}
          </Fila>
          {shift.quantity != null && shift.quantity > 1 && (
            <Fila rotulo="Personas" icono={<UsersIcon size={20} />} titulo={`${shift.quantity} personas`} />
          )}
        </dl>

        {/* Condiciones: van también sin sesión — es con lo que alguien que
            llega por WhatsApp decide si le conviene registrarse. */}
        {(shift.meal || shift.tips || shift.dress_code) && (
          <section className="mt-6">
            <h2 className="text-sm font-bold text-ink">Qué incluye</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {shift.tips && <Chip icon={<WalletIcon size={14} />}>Propinas</Chip>}
              {shift.meal && <Chip icon={<UtensilsIcon size={14} />}>Comida del personal</Chip>}
              {shift.dress_code && <Chip icon={<FileTextIcon size={14} />}>Vestimenta: {shift.dress_code}</Chip>}
            </div>
          </section>
        )}

        {full?.description && (
          <section className="mt-6">
            <h2 className="text-sm font-bold text-ink">Lo que piden</h2>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-[1.45] text-ink-soft">
              {full.description}
            </p>
          </section>
        )}

        {hasCoords && (
          <section className="mt-6">
            <h2 className="text-sm font-bold text-ink">Ubicación</h2>
            <div className="mt-2 overflow-hidden rounded-[20px]">
              <MiniMap latitude={shift.latitude!} longitude={shift.longitude!} className="h-40 w-full" nombre={shift.company_name} />
            </div>
          </section>
        )}

        {/* U110: discreto, sin acento. Sólo un trabajador con sesión puede
            atar el turno a un ticket. */}
        {isWorker && (
          <div className="mt-5 flex justify-center">
            <Link
              href={reportShiftHref(shift.id)}
              className="flex min-h-11 items-center text-sm font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              Reportar un problema
            </Link>
          </div>
        )}
        {!loading && !user && (
          <p className="mt-6 text-center text-xs text-ink-soft">
            Creá tu perfil gratis y postulate a este y otros turnos gastronómicos.
          </p>
        )}

        {/* La acción, fija abajo: se queda pegada al borde de la pantalla
            mientras la hoja pasa por detrás. Es el único ámbar. */}
        {hayAccion && (
          <div
            ref={accionRef}
            data-testid="turno-accion"
            className={`turno-accion z-[5] -mx-5 mt-auto px-5 pt-7 md:bottom-0 md:-mx-8 md:rounded-b-[28px] md:px-8 md:pb-6 ${
              accionSuelta ? "" : "sticky"
            } ${
              conBarra
                ? `${accionSuelta ? "" : "turno-accion-sobre-barra "}bottom-[var(--chrome-bottom)] pb-2`
                : "turno-accion-al-borde bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            }`}
          >
            <PrimaryAction
              loading={loading || (isWorker && apply === "unknown")}
              loggedIn={Boolean(user)}
              isWorker={isWorker}
              isOwner={isOwner}
              shiftId={shift.id}
              apply={apply}
              justApplied={justApplied}
              commits={Boolean(shift.apply_commits)}
              ofrecido={ofrecido}
              onApply={onApply}
            />
          </div>
        )}
      </section>
      {dialogo}
    </div>
  );
}

/** Un dato del turno en una fila: el ícono en su casilla, el dato en negrita
 *  y, si hay, una línea de detalle y algo para tocar a la derecha. */
function Fila({
  rotulo,
  icono,
  titulo,
  detalle,
  children,
}: {
  /** Para quien no ve el ícono: «Cuándo», «Dónde». */
  rotulo: string;
  icono: React.ReactNode;
  titulo: string;
  detalle?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <dt className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-[var(--suave-campo)] text-primary-text">
        <span aria-hidden className="flex">
          {icono}
        </span>
        <span className="sr-only">{rotulo}</span>
      </dt>
      <dd className="min-w-0 flex-1">
        <span className="block break-words text-fila font-bold leading-snug text-ink">{titulo}</span>
        {detalle && <span className="block break-words text-sm text-ink-soft">{detalle}</span>}
      </dd>
      {children && <dd className="shrink-0">{children}</dd>}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="chip-suave max-w-full break-words">
      <span className="shrink-0 text-primary-text">{icon}</span>
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
  commits,
  ofrecido,
  onApply,
}: {
  loading: boolean;
  loggedIn: boolean;
  isWorker: boolean;
  isOwner: boolean;
  shiftId: string;
  apply: ApplyState;
  justApplied: boolean;
  /** Carril urgente: postularse compromete («Puedo ir ya»). */
  commits: boolean;
  /** Se ofreció para ya: `se_ofrecio_para_ya` de su postulación. */
  ofrecido: boolean;
  onApply: () => void;
}) {
  const reducedMotion = useReducedMotion();
  if (loading) return <Skeleton className="h-14 w-full rounded-[18px]" />;

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
        <p className="mt-2.5 text-center text-sm text-ink-soft">
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
            className="rounded-[18px] bg-[var(--suave-campo)] px-4 py-3.5"
          >
            <p className="text-body font-semibold text-ink">Ya tuviste este turno asignado</p>
            <p className="text-sm text-ink-soft">Si el comercio te vuelve a elegir, te avisamos.</p>
          </motion.div>
        ) : apply === "applied" ? (
          <motion.div
            key="applied"
            {...swap}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-[18px] bg-success-tint px-4 py-3.5"
          >
            <DrawnCheck size={24} animate={justApplied} className="shrink-0 text-success-text" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink">{estadoPostulado(ofrecido).titulo}</p>
              <p className="text-sm text-ink-soft">{estadoPostulado(ofrecido).detalle}</p>
            </div>
            <Link
              href="/my-shifts"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-semibold text-primary-text"
            >
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
            {apply === "applying" ? "Enviando…" : textoPostularse({ apply_commits: commits })}
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
