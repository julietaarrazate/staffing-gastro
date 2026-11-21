"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { SKILL_LABELS, WorkerProfile } from "@/lib/types";
import { CV_OPEN_ERROR, openCv } from "@/lib/cv";
import {
  BADGE_ICONS,
  BADGE_LABELS,
  formatPunctuality,
  hasRate,
  hasRating,
  levelLabel,
  NEW_LABEL,
} from "@/lib/reputation";
import { ErrorBanner, Skeleton } from "@/components/ui";
import FichaSuave from "@/components/profile/FichaSuave";
import { DatoSuave, FilasSuaves, ReputacionGrande } from "@/components/profile/ProfileParts";
import WorkerReviews from "@/components/WorkerReviews";
import { AwardIcon, CheckIcon, ClipboardIcon, DownloadIcon, HeartIcon } from "@/components/icons";
import { plural } from "@/lib/format";

/** Botón "Favorito" (comercio → trabajador), sólo visible para empleadores
 * (el propio trabajador no ve ni sabe quién lo favoriteó — bookmark privado
 * y unidireccional, ver docs/STATUS.md). Idempotente en el backend: no hace
 * falta manejar 409 al togglear. */
function FavoriteToggle({ workerProfileId, token }: { workerProfileId: string; token: string }) {
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ is_favorite: boolean }>(`/favorites/${workerProfileId}/status`, token)
      .then((data) => {
        if (!cancelled) setIsFavorite(data.is_favorite);
      })
      .catch(() => {
        // Sin favorito visible no rompe la pantalla: el trabajador sigue
        // viéndose igual, sólo no se puede togglear hasta reintentar.
      });
    return () => {
      cancelled = true;
    };
  }, [workerProfileId, token]);

  async function toggle() {
    if (isFavorite === null || busy) return;
    setBusy(true);
    const next = !isFavorite;
    setIsFavorite(next); // optimista
    try {
      if (next) {
        await api.put<{ is_favorite: boolean }>(`/favorites/${workerProfileId}`, undefined, token);
      } else {
        await api.del<{ is_favorite: boolean }>(`/favorites/${workerProfileId}`, undefined, token);
      }
    } catch (err) {
      setIsFavorite(!next); // revertir si falló
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setBusy(false);
    }
  }

  if (isFavorite === null) return null;

  // «Agregar» es la acción de la pantalla (azul hondo, el ámbar no se usa acá);
  // ya favorito, queda quieto con el corazón lleno.
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFavorite}
      className={`boton inline-flex min-h-[48px] w-full items-center justify-center gap-2 px-5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
        isFavorite ? "boton-quieto" : "boton-hondo"
      }`}
    >
      <HeartIcon size={16} filled={isFavorite} />
      {isFavorite ? "Favorito" : "Agregar a favoritos"}
    </button>
  );
}

/** El esqueleto de la hoja: la reputación, unas líneas y las filas de datos. */
function EsqueletoHoja() {
  return (
    <div aria-hidden>
      <Skeleton className="h-16 w-56" />
      <Skeleton className="mt-5 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-5 h-40 w-full rounded-[18px]" />
    </div>
  );
}

export default function PublicWorkerProfilePage() {
  const { token, user } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cvError, setCvError] = useState<string | null>(null);
  // Sin historial (entrada directa, notificación, pestaña nueva) `back()` no
  // hace nada: se cae a Buscar, el origen razonable del comercio.
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/search");
  };

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<WorkerProfile>(`/workers/${params.id}`, token)
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el perfil")))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <FichaSuave cargando>
        <EsqueletoHoja />
      </FichaSuave>
    );
  }
  if (error) {
    return (
      <FichaSuave>
        <ErrorBanner message={error} onRetry={load} />
        <button type="button" onClick={goBack} className="boton boton-quieto mt-4 min-h-[44px] px-5 text-sm font-semibold">
          Volver
        </button>
      </FichaSuave>
    );
  }
  if (!profile) return null;

  const name = profile.full_name ?? "Trabajador/a";
  // El CV se abre con un link que vence que se pide al tocar (ADR-0021): el
  // perfil no trae una URL que sirva sola. `cv_kind` sólo llega a quien hoy
  // lo puede ver (la persona, un admin o un comercio con un turno o una
  // postulación de ella).
  const abrirCv = async (download: boolean) => {
    setCvError(null);
    if (!(await openCv(profile.id, token, download))) setCvError(CV_OPEN_ERROR);
  };

  // Un puesto que esta versión de la app no conoce no se nombra.
  const puestos = profile.skills.filter((skill) => SKILL_LABELS[skill]);
  const conHistoria = hasRate(profile.events_completed) || hasRating(profile.rating);

  return (
    <FichaSuave
      titulo={profile.age != null ? `${name}, ${profile.age}` : name}
      bajada={profile.city ?? undefined}
      fotoUrl={profile.photo_url}
      inicial={name}
      onVolver={goBack}
      sello={
        profile.identidad_verificada && (
          <span className="chip-suave text-success-text">
            <CheckIcon size={14} strokeWidth={2.6} aria-hidden />
            Identidad verificada
          </span>
        )
      }
    >
      {/* En lg+ las reseñas pasan a la columna de al lado, sobre la misma
          hoja (mismo criterio que el perfil propio); en el celular van debajo,
          en el mismo orden. Lo que más ayuda al comercio a vetear antes de
          asignar. */}
      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-5 lg:col-span-3">
          <ReputacionGrande
            rating={profile.rating}
            cantidad={profile.events_completed}
            singular="turno hecho"
            varios="turnos hechos"
            detalle={hasRate(profile.events_completed) ? `puntualidad ${formatPunctuality(profile.punctuality_rate)}` : null}
            conHistoria={conHistoria}
            mostrarCantidad={profile.events_completed > 0}
            vacio={<p className="text-fila font-semibold text-ink-soft">{NEW_LABEL}</p>}
          />

          {/* Sólo el comercio (el propio trabajador no ve ni sabe quién lo
              favoriteó: bookmark privado y unidireccional). */}
          {user?.role === "employer" && token && <FavoriteToggle workerProfileId={params.id} token={token} />}

          {profile.bio && <p className="break-words text-base text-ink">{profile.bio}</p>}

          {puestos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {puestos.map((skill) => (
                <li key={skill} className="chip-suave">
                  {SKILL_LABELS[skill]}
                </li>
              ))}
            </ul>
          )}

          <FilasSuaves as="dl">
            <DatoSuave nombre="Experiencia" valor={plural(profile.years_experience, "año", "años")} />
            <DatoSuave nombre="Nivel" valor={levelLabel(profile.level)} />
            <DatoSuave nombre="Disponibilidad" valor={profile.is_available ? "Disponible" : "No disponible"} />
            {profile.languages.length > 0 && <DatoSuave largo nombre="Idiomas" valor={profile.languages.join(", ")} />}
            {profile.certifications.length > 0 && (
              <DatoSuave largo nombre="Certificaciones" valor={profile.certifications.join(", ")} />
            )}
          </FilasSuaves>

          {profile.cv_kind && (
            <div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void abrirCv(false)}
                  className="boton boton-quieto inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition active:scale-95"
                >
                  <ClipboardIcon size={16} /> Ver CV
                </button>
                {/* Un link pegado a mano (Drive, LinkedIn) no se descarga desde acá. */}
                {profile.cv_kind === "file" && (
                  <button
                    type="button"
                    onClick={() => void abrirCv(true)}
                    className="boton boton-quieto inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition active:scale-95"
                  >
                    <DownloadIcon size={16} /> Descargar
                  </button>
                )}
              </div>
              {cvError && (
                <p role="alert" className="mt-2 text-sm text-danger-text">
                  {cvError}
                </p>
              )}
            </div>
          )}

          {profile.badges.length > 0 && (
            <div>
              <h2 className="px-1 text-caption font-semibold text-ink-soft">Insignias</h2>
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
            </div>
          )}
        </div>

        <section aria-labelledby="resenas" className="mt-7 lg:col-span-2 lg:mt-0">
          <h2 id="resenas" className="px-1 text-caption font-semibold text-ink-soft">
            Reseñas
          </h2>
          <div className="mt-2">
            <WorkerReviews workerProfileId={params.id} suave />
          </div>
        </section>
      </div>
    </FichaSuave>
  );
}
