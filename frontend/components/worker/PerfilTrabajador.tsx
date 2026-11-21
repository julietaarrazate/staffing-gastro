"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import ImageUpload from "@/components/ImageUpload";
import { saveProfilePart } from "@/lib/worker-profile";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerEarnings, WorkerProfile } from "@/lib/types";
import {
  BADGE_ICONS,
  BADGE_LABELS,
  formatPunctuality,
  levelLabel,
} from "@/lib/reputation";
import { ErrorBanner, NubesCielo, SinFoto, Skeleton } from "@/components/ui";
import EditableName from "@/components/EditableName";
import AvailableNowToggle from "@/components/worker/AvailableNowToggle";
import IdentityVerificationCard from "@/components/worker/IdentityVerificationCard";
import ReceivedReviews from "@/components/ReceivedReviews";
import { DatoSuave as Dato, FilaSuave, FilasSuaves, ReputacionGrande } from "@/components/profile/ProfileParts";
import { shareBusinessInvite } from "@/lib/business-invite";
import { AwardIcon, CheckIcon, PencilIcon } from "@/components/icons";
import { formatArs } from "@/lib/format";

const LISTA = new Intl.ListFormat("es", { style: "long", type: "conjunction" });

/**
 * El Perfil de quien trabaja, con la dirección suave (ADR-0028, maqueta
 * `T-Perfil`): «¿cómo me ven?». El cielo medio con el nombre, los puestos y la
 * zona; la foto a caballo de la hoja; y en la hoja la reputación como número
 * grande, una reseña y el resto de los datos y accesos como filas suaves.
 *
 * Reemplaza a la tarjeta `WorkerGameCard` y a las filas con ícono de color:
 * los datos y las acciones son los mismos (foto, nombre, nivel, nota, turnos,
 * puntualidad, ganancias, cancelaciones, ausencias, años, insignias, puestos,
 * verificación de identidad, «Disponible ahora», editar, invitar, ajustes y
 * las reseñas). El perfil del comercio y el del admin siguen en
 * `app/profile/page.tsx`, sin cambios.
 */
export default function PerfilTrabajador() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [earnings, setEarnings] = useState<WorkerEarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Lo avisa la tarjeta de verificación, que ya pide `/identity/me`. Hasta que
  // contesta vale lo que dice el perfil.
  const [estadoIdentidad, setEstadoIdentidad] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<WorkerProfile>("/workers/me/profile", token)
      .then(setProfile)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar tu reputación")
      )
      .finally(() => setLoading(false));
    // Aparte del perfil: si falla, la pantalla igual se ve completa sin las
    // ganancias, en vez de tapar toda la reputación por esto.
    api
      .get<WorkerEarnings>("/workers/me/earnings", token)
      .then(setEarnings)
      .catch(() => {});
  }, [token]);

  async function savePhoto(url: string) {
    if (!token) return;
    // El endpoint reemplaza el perfil, no lo parchea. `saveProfilePart` lee el
    // perfil del servidor justo antes de escribir (la copia de esta pantalla
    // puede estar vieja si la persona guardó otra cosa en otra pestaña) y
    // manda todo con la foto nueva encima.
    setPhotoError(null);
    try {
      const saved = await saveProfilePart(token, { photo_url: url });
      setProfile(saved);
    } catch {
      // `ImageUpload` no espera este guardado: sin aviso, la foto subida
      // quedaba sin guardar y la persona no se enteraba.
      setPhotoError("No pudimos guardar tu foto. Probá de nuevo.");
    }
  }

  const verificada = estadoIdentidad
    ? estadoIdentidad === "verificada"
    : Boolean(profile?.identidad_verificada);
  // Un solo ámbar por pantalla: mientras el formulario de verificación está a
  // la vista, la acción es «Enviar a revisión» y «Disponible ahora» va quieta.
  const verificacionALaVista = !verificada && estadoIdentidad !== "pendiente";

  // Las métricas aparecen con el primer turno completado (sobrecarga visual,
  // 2026-09-30): a quien recién arranca no se le muestra una pantalla de
  // ceros diciéndole lo que no tiene.
  const hasHistory = (profile?.events_completed ?? 0) > 0;
  // Las cancelaciones y las ausencias no esperan al primer turno hecho: son
  // parte de la reputación desde que existen, y esconderlas le hace creer a la
  // persona que no cuentan (U082/U089). Sólo se ven acá, en el perfil propio:
  // lo que ve un comercio sale de otra pantalla y no cambia.
  const hasStrikes = Boolean(profile && (profile.cancellations > 0 || profile.no_shows > 0));
  const conGanancias = hasHistory && earnings !== null && Number(earnings.total_earned) > 0;

  // Un puesto que esta versión de la app no conoce no se nombra.
  const puestos = (profile?.skills ?? []).map((skill) => SKILL_LABELS[skill]).filter(Boolean);
  const bajada = [puestos.length > 0 ? LISTA.format(puestos) : null, profile?.city || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      {/* El cielo medio: el nombre, los puestos y la zona. La foto no vive
          acá sino en la hoja, que la sube 60 px sobre el cielo. */}
      <div className="app-cielo cielo-limpio px-5 pb-11 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6">
        <NubesCielo nubes={[{ forma: "a", ancho: 250, pos: { right: -56, top: 44 } }]} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* El título de la pantalla es el nombre. El botón que lo edita
                se llama «Editar nombre», así que el encabezado va aparte:
                adentro del `h1`, un lector de pantalla anunciaba «Editar
                nombre» como título. */}
            <h1 className="sr-only">{user?.full_name ?? "Perfil"}</h1>
            <div className="titulo-pantalla">
              <EditableName />
            </div>
            {bajada && <p className="mt-1 break-words text-fila font-semibold">{bajada}</p>}
          </div>
          <Link
            href="/profile/edit"
            aria-label="Editar perfil"
            className="boton-vidrio h-11 w-11 shrink-0 transition active:scale-95"
          >
            <PencilIcon size={20} />
          </Link>
        </div>
        {/* A la derecha de la foto, que asoma desde la hoja. */}
        <div className="ml-[124px] mt-4 flex min-h-8 items-center">
          {profile && <span className="chip-vidrio">Nivel {levelLabel((profile.level ?? "bronce").toLowerCase())}</span>}
        </div>
      </div>

      <div className="hoja -mt-7 flex-1 px-5 pb-10 pt-[18px] md:px-6">
        {/* La foto se sube ACÁ, tocándola (Julieta, 2026-09: «la foto se tiene
            que poder subir arriba con el nombre»), y se guarda sola. */}
        <div className="perfil-foto absolute left-5 top-[-60px] z-[2] md:left-6">
          {profile ? (
            <ImageUpload
              avatar
              size={108}
              value={profile.photo_url}
              onChange={savePhoto}
              fallbackLabel={user?.full_name ?? "Vos"}
            />
          ) : (
            <div className="foto-subir h-[108px] w-[108px] overflow-hidden rounded-full">
              <SinFoto nombre={user?.full_name ?? "V"} id={user?.id} />
            </div>
          )}
        </div>

        <div className="flex min-h-8 justify-end pl-[124px]">
          {verificada && (
            <span className="chip-suave text-success-text">
              <CheckIcon size={14} strokeWidth={2.6} aria-hidden />
              Identidad verificada
            </span>
          )}
        </div>
        {photoError && (
          <p role="alert" className="mt-5 text-sm font-semibold text-danger-text">
            {photoError}
          </p>
        )}

        <div className="mt-7 lg:grid lg:grid-cols-5 lg:items-start lg:gap-10">
          <div className="flex flex-col gap-5 lg:col-span-3">
            {loading && (
              <div aria-hidden>
                <Skeleton className="h-16 w-56" />
                <Skeleton className="mt-5 h-24 w-full" />
              </div>
            )}
            {error && <ErrorBanner message={error} />}

            {profile && (
              <ReputacionGrande
                rating={profile.rating}
                cantidad={profile.events_completed}
                singular="turno hecho"
                varios="turnos hechos"
                detalle={`puntualidad ${formatPunctuality(profile.punctuality_rate)}`}
                conHistoria={hasHistory}
                vacio={
                  <p className="text-fila font-semibold text-ink-soft">
                    Tu reputación arranca con tu primer turno.
                  </p>
                }
              />
            )}

            {/* Sin reseñas no se muestra nada: una sección que dice «Todavía
                no tenés reseñas» es otra cosa que le cuenta a la persona nueva
                lo que no tiene. */}
            <ReceivedReviews suave />

            {/* La verificación va arriba mientras no está aprobada: es lo que
                destraba todo. Aprobada, el sello es el chip de arriba y acá
                queda sólo la nota, al final de la hoja. */}
            {!verificada && (
              <div className="caja-suave">
                <IdentityVerificationCard onStatusChange={setEstadoIdentidad} />
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:col-span-2 lg:mt-0">
            <AvailableNowToggle token={token} quieta={verificacionALaVista} />

            {profile && (hasHistory || hasStrikes) && (
              <div>
                <FilasSuaves as="dl">
                  {conGanancias && earnings && (
                    <Dato
                      nombre="Ganado este mes"
                      detalle={`${formatArs(Number(earnings.total_earned))} en total`}
                      valor={formatArs(Number(earnings.this_month_earned))}
                    />
                  )}
                  <Dato nombre="Cancelaciones" valor={String(profile.cancellations)} />
                  {(profile.no_shows > 0 || !hasHistory) && (
                    <Dato nombre="Ausencias" valor={String(profile.no_shows)} />
                  )}
                  {hasHistory && (
                    <Dato nombre="Años de experiencia" valor={String(profile.years_experience)} />
                  )}
                </FilasSuaves>
                {/* Si una no corresponde, el camino es Soporte: un toque, no
                    «buscalo en Ajustes». */}
                {hasStrikes && (
                  <p className="mt-3 px-1 text-caption text-ink-soft">
                    ¿Alguna no corresponde? Escribinos a{" "}
                    <Link
                      href="/support"
                      className="font-semibold text-primary-text underline underline-offset-2"
                    >
                      Soporte
                    </Link>
                  </p>
                )}
              </div>
            )}

            {profile && hasHistory && (
              <div>
                <h2 className="px-1 text-caption font-semibold text-ink-soft">Insignias</h2>
                {profile.badges.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {profile.badges.map((badge) => {
                      const Icon = BADGE_ICONS[badge] ?? AwardIcon;
                      return (
                        <li key={badge} className="chip-suave">
                          <Icon size={14} className="text-primary-text" aria-hidden />
                          {BADGE_LABELS[badge] ?? badge}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 px-1 text-sm text-ink-soft">
                    Todavía no tenés insignias — completá turnos para ganarlas.
                  </p>
                )}
              </div>
            )}

            <FilasSuaves>
              {/* Una fila y no una tarjeta: es una acción que se usa de vez en
                  cuando, no algo que el perfil tenga que gritar. */}
              <FilaSuave onClick={shareBusinessInvite}>Invitá a tu comercio</FilaSuave>
              <FilaSuave href="/profile/settings">Ajustes</FilaSuave>
            </FilasSuaves>

            {verificada && <IdentityVerificationCard sinSello onStatusChange={setEstadoIdentidad} />}
          </div>
        </div>
      </div>
    </div>
  );
}
