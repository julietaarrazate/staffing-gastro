"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { isCancellable } from "@/lib/cancelar-turno";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Applicant, CandidateMatch, SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { formatShiftStartPhrase, formatShiftWhen } from "@/lib/datetime";
import {
  activeApplicantCount,
  isUnassigned,
  rankApplicants,
  standoutApplicant,
  unassignedLabel,
} from "@/lib/applicants";
import CandidatoDestacado from "@/components/candidate/CandidatoDestacado";
import CandidatoFila from "@/components/candidate/CandidatoFila";
import GuaranteeCard from "@/components/candidate/GuaranteeCard";
import OidoElegido from "@/components/candidate/OidoElegido";
import {
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  NubesCielo,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import { useLiveRefresh } from "@/lib/live-refresh";
import { ChevronLeftIcon, UsersIcon } from "@/components/icons";

type Tab = "postulantes" | "recomendados";

// Mismos estados desde los que el servidor deja asignar (`Shift.assign`).
// Mientras el turno no cargó se asume asignable (el servidor igual decide).
const ASSIGNABLE_STATUSES = ["publicado", "buscando_personal"];

/**
 * Carga una lista. 404 (turno ajeno o inexistente) = lista vacía, como
 * siempre; cualquier otra falla deja `error` y conserva lo ya cargado. Una
 * respuesta vieja que llega tarde no pisa a la más nueva.
 */
function useLoadedList<T>(path: string, token: string | null | undefined) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  // `silent` (recarga por un aviso, ver `lib/live-refresh.ts`): sin esqueleto
  // y sin marcar error si falla; se conserva lo que ya se ve.
  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!token) return;
    const mine = ++latest.current;
    if (!silent) setLoading(true);
    try {
      const data = await api.get<T[]>(path, token);
      if (mine !== latest.current) return;
      setItems(data);
      setError(false);
    } catch (err) {
      if (mine !== latest.current) return;
      if (isNotFound(err)) {
        setItems([]);
        setError(false);
      } else if (!silent) {
        setError(true);
      }
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path, token]);
  return { items, error, loading, reload };
}

function ShiftCandidatesContent() {
  const { token } = useRequireAuth({ roles: ["employer"] });
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const shiftId = params.id;
  const searchParams = useSearchParams();
  // El tab va en la URL (no sólo en state) para que al entrar a un perfil
  // desde "Recomendados" y volver atrás, el back nativo del navegador
  // restaure el mismo tab en vez de reiniciar en "Postulantes" (bug
  // reportado por Julieta: "vuelvo atrás y sale de los recomendados").
  const [tab, setTabState] = useState<Tab>(
    searchParams.get("tab") === "recomendados" ? "recomendados" : "postulantes"
  );
  function setTab(next: Tab) {
    setTabState(next);
    router.replace(`/shifts/${shiftId}/candidates?tab=${next}`, { scroll: false });
  }
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftError, setShiftError] = useState(false);
  // Sin el estado del turno no se ofrece «Asignar»: se carga o se reintenta.
  const canAssign = shift !== null && ASSIGNABLE_STATUSES.includes(shift.status);
  // La «Garantía Oído» vale mientras el turno está vivo: buscando, o con
  // alguien asignado o confirmado («si no se presenta, reabrís el turno»).
  // Con el turno cerrado (cancelado, terminado, pagado, sin cubrir) ya no
  // aplica. Mientras no se sabe el estado (cargando o con error) no se
  // muestra, para que no aparezca y desaparezca.
  const mostrarGarantia = shift !== null && isCancellable(shift.status);
  // Cada lista carga y falla por su cuenta. Un error NUNCA se convierte en
  // lista vacía: «Todavía nadie se postuló» sólo aparece si el servidor
  // contestó bien con cero postulantes. Si ya había datos y una recarga
  // falla, se conservan y se avisa.
  const {
    items: applicants,
    error: appsError,
    loading: loadingApps,
    reload: reloadApps,
  } = useLoadedList<Applicant>(`/applications/shifts/${shiftId}`, token);
  const {
    items: candidates,
    error: candsError,
    loading: loadingCands,
    reload: reloadCands,
  } = useLoadedList<CandidateMatch>(`/shifts/${shiftId}/candidates`, token);
  const rankedApplicants = useMemo(() => rankApplicants(applicants), [applicants]);
  const standout = standoutApplicant(rankedApplicants);
  // Quien va en la tarjeta grande: el primero del orden de siempre
  // (`rankApplicants`), salvo que ya haya tenido este turno y lo haya dejado
  // (esos van al final, en fila y con su marca). «Mejor calificación» sólo si
  // tiene turnos hechos que lo respalden (`standoutApplicant`).
  const primero = rankedApplicants[0] && !isUnassigned(rankedApplicants[0]) ? rankedApplicants[0] : null;
  const restoPostulantes = primero ? rankedApplicants.slice(1) : rankedApplicants;
  // La pestaña cuenta a quienes están en carrera, como el panel: quien tuvo
  // el turno y lo dejó se lista al final pero no suma (G4).
  const activeApplicants = useMemo(() => activeApplicantCount(applicants), [applicants]);
  const [assigning, setAssigning] = useState<string | null>(null);
  // Recién elegido: la pantalla «¡Oído!» tapa todo y de ahí se va al chat o
  // al panel. La decisión se VE, en vez de sólo un toast sobre una pantalla
  // que ya se fue (hasta el 2026-11-20, la tarjeta subía con «Asignado» y a
  // los 1,1 s se volvía sola al panel).
  const [elegido, setElegido] = useState<{ nombre: string; foto: string | null } | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(({ silent = false }: { silent?: boolean } = {}) => {
    reloadApps({ silent });
    reloadCands({ silent });
    // Aparte de la carga principal: si falla, la pantalla igual funciona sin
    // el resumen del turno de arriba (era información nueva agregada acá, no
    // el contenido central de esta pantalla).
    if (token) {
      api
        .get<Shift>(`/shifts/${shiftId}`, token)
        .then((data) => {
          setShift(data);
          setShiftError(false);
        })
        .catch(() => {
          if (!silent) setShiftError(true);
        });
    }
  }, [reloadApps, reloadCands, token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (G1, U014): llega una postulación nueva, o se cae el
  // turno, y la lista se actualiza sola. En pausa mientras se asigna.
  useLiveRefresh(load, {
    paused: loadingApps || loadingCands || assigning !== null || elegido !== null,
  });

  async function assign(profileId: string, persona: { nombre: string; foto: string | null }) {
    if (!token) return;
    setAssigning(profileId);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // turno+candidato) reusa la key hasta que la asignación termine bien.
      const attemptKey = `${shiftId}:${profileId}`;
      await api.post(
        `/shifts/${shiftId}/assign`,
        { worker_profile_id: profileId },
        token,
        undefined,
        keyFor(attemptKey)
      );
      clearIdempotencyKey(attemptKey);
      // `assigning` queda puesto: detrás de «¡Oído!» nadie vuelve a elegir.
      setElegido(persona);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo asignar"), "error");
      setAssigning(null);
      // Si falló, lo que se ve pudo haberse quedado viejo (la persona retiró su
      // postulación, el turno ya cambió): se vuelve a pedir, en silencio (VIE-01).
      load({ silent: true });
    }
  }

  // El título dice lo que la pantalla responde: cuántos levantaron la mano.
  const titulo =
    activeApplicants === 0
      ? "Candidatos"
      : activeApplicants === 1
        ? "Se postuló 1"
        : `Se postularon ${activeApplicants}`;
  const elegir = (id: string, nombre: string, foto: string | null) =>
    canAssign ? () => assign(id, { nombre, foto }) : undefined;

  return (
    // Con la dirección suave desde el 2026-11-20 (ADR-0028,
    // docs/design-system/direccion-relieve.md, «Identidad por pantalla»): un
    // cielo corto con la vuelta, el turno en un renglón y el título; en la
    // hoja, la persona destacada como tarjeta (su foto con el nombre encima;
    // sin foto, el cielo hondo con sus iniciales y sus datos), «Elegir a
    // <nombre>» como único ámbar, y los demás en filas. Al elegir, «¡Oído!».
    // Del 2026-11-18 al 19 fue «con relieve» (título en brocha, el turno
    // como comanda, el destacado con el relieve del filete). El orden, quién
    // se destaca, las dos pestañas y la asignación no cambiaron.
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-2xl md:px-4 md:pt-4">
      <div className="app-cielo cielo-limpio px-5 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-6">
        {/* Una sola nube, que asoma a la derecha detrás del título. */}
        <NubesCielo nubes={[{ forma: "a", ancho: 230, pos: { right: -90, top: 10 } }]} />
        <div className="flex min-h-11 items-center gap-3">
          <Link href="/shifts" aria-label="Volver al panel" className="boton-vidrio h-11 w-11 shrink-0">
            <ChevronLeftIcon size={22} />
          </Link>
          {/* PARA QUÉ turno son estos candidatos: un comercio con varios
              turnos abiertos puede llegar acá desde el panel, un link del
              asistente o el próximo paso de publicar. Mismo `GET /shifts/{id}`
              de siempre; el pago y la duración quedan en el panel. */}
          {shift && (
            <p data-testid="candidatos-turno" className="min-w-0 break-words text-[length:var(--text-fila)] font-semibold leading-snug">
              {SKILL_LABELS[shift.position]} ·{" "}
              {/* El horario no se parte: si no entra, baja entero. */}
              <span className="whitespace-nowrap">
                {formatShiftWhen(shift.start_at, shift.end_at).replace(" · ", ", ")}
              </span>
            </p>
          )}
        </div>
        <h1 className="titulo-pantalla mt-3.5 break-words">{titulo}</h1>
      </div>

      {/* La hoja sube 28 px sobre el cielo y lleva todo lo que se toca. */}
      <div className="hoja -mt-7 flex-1 px-5 pb-8 pt-3 md:px-6">
        {!shift && shiftError && (
          <ErrorBanner message="No pudimos cargar el estado del turno, así que por ahora no se puede asignar." onRetry={() => load()} />
        )}
        {!canAssign && shift && (
          <p
            role="status"
            data-testid="candidatos-turno-cerrado"
            className="mb-2 mt-2 rounded-[18px] bg-[var(--suave-campo)] p-3.5 text-sm text-ink-soft"
          >
            {shift.status === "asignado"
              ? "Este turno ya tiene a alguien asignado: no se puede asignar a otra persona."
              : `Este turno está ${STATUS_LABELS[shift.status as keyof typeof STATUS_LABELS]?.toLowerCase() ?? shift.status}: ya no se puede asignar a nadie.`}
          </p>
        )}

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "postulantes", label: `Postulantes${activeApplicants > 0 ? ` (${activeApplicants})` : ""}` },
            { value: "recomendados", label: `Recomendados${candidates.length > 0 ? ` (${candidates.length})` : ""}` },
          ]}
        />

        {tab === "postulantes" && loadingApps && <CardSkeletons />}
        {tab === "recomendados" && loadingCands && <CardSkeletons />}

        {/* El aviso de postulantes va en las dos pestañas: es la lista principal
            y el error no puede quedar escondido tras la otra pestaña. */}
        {!loadingApps && appsError && (
          <ErrorBanner
            message={
              applicants.length > 0
                ? "No pudimos actualizar los postulantes. Te mostramos los que ya habían cargado."
                : "No pudimos cargar los postulantes. Reintentá en un momento."
            }
            onRetry={() => reloadApps()}
          />
        )}
        {tab === "recomendados" && !loadingCands && candsError && (
          <ErrorBanner
            message={
              candidates.length > 0
                ? "No pudimos actualizar los recomendados. Te mostramos los que ya habían cargado."
                : "No pudimos cargar los recomendados. Reintentá en un momento."
            }
            onRetry={() => reloadCands()}
          />
        )}
        {tab === "postulantes" && !loadingCands && candsError && (
          <p role="status" className="mt-3 text-xs text-ink-soft">
            No pudimos cargar los recomendados.{" "}
            <button
              type="button"
              onClick={() => reloadCands()}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </p>
        )}

        {tab === "postulantes" && !loadingApps && (!appsError || applicants.length > 0) && (
          <div className="mt-4">
            {applicants.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={28} />}
                title="Todavía nadie se postuló"
                subtitle="Cuando un trabajador se postule a tu turno, aparece acá. Mientras tanto, mirá los recomendados."
              />
            ) : (
              <>
                {/* Ordenados para decidir rápido (`rankApplicants`): primero
                    quien ya tiene turnos hechos, después por calificación y
                    puntualidad. El primero va en la tarjeta grande con el
                    único ámbar de la pantalla: UNA acción principal, no una
                    por persona. La Garantía va DESPUÉS de la lista: antes
                    ocupaba la mitad de la pantalla antes del primer
                    postulante. */}
                {primero && (
                  <CandidatoDestacado
                    perfilId={primero.worker_profile_id}
                    nombre={primero.full_name}
                    foto={primero.photo_url}
                    verificada={primero.identidad_verificada}
                    signals={primero}
                    rotulo={standout?.application_id === primero.application_id ? "Mejor calificación" : null}
                    onElegir={elegir(primero.worker_profile_id, primero.full_name, primero.photo_url)}
                    eligiendo={assigning === primero.worker_profile_id}
                    bloqueado={assigning !== null}
                  />
                )}
                {restoPostulantes.length > 0 && (
                  <>
                    {primero && <h2 className="titulo-seccion mt-6">También se postularon</h2>}
                    <ul className={`space-y-2.5 ${primero ? "mt-3" : ""}`}>
                      {restoPostulantes.map((a) => (
                        <li key={a.application_id}>
                          <CandidatoFila
                            perfilId={a.worker_profile_id}
                            nombre={a.full_name}
                            foto={a.photo_url}
                            verificada={a.identidad_verificada}
                            signals={a}
                            disponible={a.is_available}
                            // Tuvo este turno y lo dejó: va al final
                            // (`rankApplicants`), con su marca, y se le puede
                            // volver a asignar (G4).
                            marca={unassignedLabel(a)}
                            onElegir={elegir(a.worker_profile_id, a.full_name, a.photo_url)}
                            eligiendo={assigning === a.worker_profile_id}
                            bloqueado={assigning !== null}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {mostrarGarantia && (
                  <div className="mt-6">
                    <GuaranteeCard />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "recomendados" && !loadingCands && (!candsError || candidates.length > 0) && (
          <div className="mt-4">
            {candidates.length === 0 ? (
              <EmptyState
                icon={<UsersIcon size={28} />}
                title="Sin recomendados por ahora"
                subtitle="El sistema sigue buscando trabajadores disponibles para este turno en tiempo real."
              />
            ) : (
              <>
                {/* El primero del matching, en la tarjeta grande; los demás,
                    en filas. */}
                <CandidatoDestacado
                  perfilId={candidates[0].profile_id}
                  nombre={candidates[0].full_name}
                  foto={candidates[0].photo_url}
                  verificada={candidates[0].identidad_verificada}
                  signals={candidates[0]}
                  rotulo="Recomendación de Oído"
                  onElegir={elegir(candidates[0].profile_id, candidates[0].full_name, candidates[0].photo_url)}
                  eligiendo={assigning === candidates[0].profile_id}
                  bloqueado={assigning !== null}
                />
                {candidates.length > 1 && (
                  <>
                    <h2 className="titulo-seccion mt-6">También te recomendamos</h2>
                    <ul className="mt-3 space-y-2.5">
                      {candidates.slice(1).map((c) => (
                        <li key={c.profile_id}>
                          <CandidatoFila
                            perfilId={c.profile_id}
                            nombre={c.full_name}
                            foto={c.photo_url}
                            verificada={c.identidad_verificada}
                            signals={c}
                            onElegir={elegir(c.profile_id, c.full_name, c.photo_url)}
                            eligiendo={assigning === c.profile_id}
                            bloqueado={assigning !== null}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {mostrarGarantia && (
                  <div className="mt-6">
                    <GuaranteeCard />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {elegido && (
        <OidoElegido
          nombre={elegido.nombre}
          foto={elegido.foto}
          local={shift?.company_name ?? null}
          fotoLocal={shift?.company_cover_url ?? shift?.company_logo_url ?? null}
          fotoLocalEsLogo={!shift?.company_cover_url && Boolean(shift?.company_logo_url)}
          detalle={shift ? `${SKILL_LABELS[shift.position]}, ${formatShiftStartPhrase(shift.start_at)}.` : null}
          chatHref={`/chats/${shiftId}`}
          panelHref="/shifts"
          onCerrar={() => router.push("/shifts")}
        />
      )}
    </div>
  );
}

export default function ShiftCandidatesPage() {
  return (
    <Suspense fallback={null}>
      <ShiftCandidatesContent />
    </Suspense>
  );
}
