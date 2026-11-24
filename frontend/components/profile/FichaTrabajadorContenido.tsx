"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
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
import { DatoSuave, FilasSuaves, ReputacionGrande } from "@/components/profile/ProfileParts";
import WorkerReviews from "@/components/WorkerReviews";
import { AwardIcon, ClipboardIcon, DownloadIcon, HeartIcon } from "@/components/icons";
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

/**
 * Lo que se cuenta de una persona en su ficha vista desde afuera: la
 * reputación, el favorito (sólo el comercio), la bio, los puestos, los datos,
 * el CV, las insignias y las reseñas. Lo comparten `/workers/[id]` (la
 * pantalla entera) y la ficha al lado de Candidatos en la compu
 * (`candidate/FichaCandidato`), para que las dos digan siempre lo mismo.
 *
 * `enColumnas`: en lg+ las reseñas pasan a la columna de al lado (la
 * pantalla entera); sin esto, todo va en una columna (el panel de Candidatos).
 */
export default function FichaTrabajadorContenido({
  profile,
  workerId,
  token,
  esComercio,
  enColumnas = false,
}: {
  profile: WorkerProfile;
  workerId: string;
  token: string | null | undefined;
  esComercio: boolean;
  enColumnas?: boolean;
}) {
  const [cvError, setCvError] = useState<string | null>(null);
  // El CV se abre con un link que vence que se pide al tocar (ADR-0021): el
  // perfil no trae una URL que sirva sola. `cv_kind` sólo llega a quien hoy
  // lo puede ver (la persona, un admin o un comercio con un turno o una
  // postulación de ella).
  const abrirCv = async (download: boolean) => {
    setCvError(null);
    if (!(await openCv(profile.id, token ?? null, download))) setCvError(CV_OPEN_ERROR);
  };
  // Un puesto que esta versión de la app no conoce no se nombra.
  const puestos = profile.skills.filter((skill) => SKILL_LABELS[skill]);
  const conHistoria = hasRate(profile.events_completed) || hasRating(profile.rating);

  return (
      <div className={enColumnas ? "lg:grid lg:grid-cols-5 lg:items-start lg:gap-10" : undefined}>
        <div className={`flex flex-col gap-5 ${enColumnas ? "lg:col-span-3" : ""}`}>
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
          {esComercio && token && <FavoriteToggle workerProfileId={workerId} token={token} />}

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

        <section aria-labelledby="resenas" className={`mt-7 ${enColumnas ? "lg:col-span-2 lg:mt-0" : ""}`}>
          <h2 id="resenas" className="px-1 text-caption font-semibold text-ink-soft">
            Reseñas
          </h2>
          <div className="mt-2">
            <WorkerReviews workerProfileId={workerId} suave />
          </div>
        </section>
      </div>
  );
}
