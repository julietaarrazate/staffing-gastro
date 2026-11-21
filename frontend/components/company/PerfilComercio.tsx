"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CompanyProfile } from "@/lib/types";
import { formatPunctuality, formatRating, hasPaymentRate, hasRating } from "@/lib/reputation";
import { ErrorBanner, NubesCielo, Skeleton } from "@/components/ui";
import BusinessVerificationCard from "@/components/company/BusinessVerificationCard";
import LateCancellations from "@/components/company/LateCancellations";
import EditableName from "@/components/EditableName";
import ReceivedReviews from "@/components/ReceivedReviews";
import { Estrellas, FilaSuave, FilasSuaves } from "@/components/profile/ProfileParts";
import { CheckIcon, PencilIcon } from "@/components/icons";
import { plural } from "@/lib/format";

/**
 * El Perfil del comercio, con la dirección suave (ADR-0028; sin maqueta: con
 * las piezas del Perfil de quien trabaja, `worker/PerfilTrabajador`). Responde
 * «¿cómo me ven?»: el cielo con el nombre del local, su rubro y su barrio; el
 * logo a caballo de la hoja; y en la hoja la reputación como número grande,
 * una reseña, la verificación del comercio y los accesos como filas suaves.
 *
 * Los datos y las acciones son los de antes (verificación, cancelaciones
 * tardías, reseñas, Datos del comercio, Mi plan, Favoritos, Ajustes y el
 * nombre de quien está a cargo, que se edita acá). Lo nuevo a la vista es lo
 * que ya llegaba en `GET /companies/me/profile` y no se mostraba: el nombre
 * del local, el logo, la nota, los turnos publicados y el pago a tiempo, que
 * es lo que ve quien trabaja en la ficha del comercio.
 *
 * Sin perfil de comercio todavía (404), el cielo lleva el nombre de la cuenta
 * y la hoja sólo los accesos: «Datos del comercio» es por donde se completa.
 */
export default function PerfilComercio() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // La tarjeta de verificación ya pide `/identity/me`: avisa acá si la
  // constancia está aprobada, sin pedirlo dos veces.
  const [verificado, setVerificado] = useState(false);
  // Un logo que no carga (archivo borrado, sin red) vuelve a la inicial.
  const [logoRoto, setLogoRoto] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then(setProfile)
      .catch((err) => {
        // Sin perfil todavía no es un error: la pantalla se ve con los accesos.
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar tu comercio");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const nombre = profile?.name || user?.full_name || "Perfil";
  const bajada = [profile?.category || null, profile?.city || null].filter(Boolean).join(" · ");
  const conHistoria = (profile?.events_published ?? 0) > 0;
  const conPagos = profile ? hasPaymentRate(profile.payments_recorded, profile.events_published) : false;

  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      {/* El cielo medio: el nombre del local, el rubro y el barrio. El logo no
          vive acá sino en la hoja, que lo sube 60 px sobre el cielo. */}
      <div className="app-cielo cielo-limpio px-5 pb-11 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6">
        <NubesCielo nubes={[{ forma: "a", ancho: 250, pos: { right: -56, top: 44 } }]} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Mientras no se sabe el nombre del local no se pone el de la
                cuenta para cambiarlo un instante después: una barra, y el
                `h1` sólo para lectores. */}
            {loading ? (
              <>
                <h1 className="sr-only">Perfil</h1>
                <div
                  aria-hidden
                  className="h-[35px] w-[62%] animate-pulse rounded-full bg-[rgba(255,255,255,0.35)] motion-reduce:animate-none"
                />
              </>
            ) : (
              <h1 className="titulo-pantalla line-clamp-2 break-words">{nombre}</h1>
            )}
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
        {/* A la derecha del logo, que asoma desde la hoja. */}
        <div className="ml-[124px] mt-4 flex min-h-8 items-center">
          <span className="chip-vidrio">Comercio</span>
        </div>
      </div>

      <div className="hoja -mt-7 flex-1 px-5 pb-10 pt-[18px] md:px-6">
        {/* El logo se cambia en «Datos del comercio» (el lápiz de arriba). */}
        <div className="perfil-foto absolute left-5 top-[-60px] z-[2] md:left-6">
          {profile?.logo_url && !logoRoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo chico (108 px) de Cloudinary, no amerita next/image
            <img
              src={profile.logo_url}
              alt=""
              width={108}
              height={108}
              onError={() => setLogoRoto(true)}
              className="foto-subir h-[108px] w-[108px] rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="foto-subir flex h-[108px] w-[108px] items-center justify-center rounded-full text-3xl font-bold"
            >
              {loading ? "" : nombre.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex min-h-8 justify-end pl-[124px]">
          {/* Sólo con la constancia aprobada (claim `negocio_verificado`, G5):
              el mail confirmado no alcanza para decir «verificado». */}
          {verificado && (
            <span className="chip-suave text-success-text">
              <CheckIcon size={14} strokeWidth={2.6} aria-hidden />
              Comercio verificado
            </span>
          )}
        </div>

        <div className="mt-7 lg:grid lg:grid-cols-5 lg:items-start lg:gap-10">
          <div className="flex flex-col gap-5 lg:col-span-3">
            {loading && (
              <div aria-hidden>
                <Skeleton className="h-16 w-56" />
                <Skeleton className="mt-5 h-24 w-full" />
              </div>
            )}
            {error && <ErrorBanner message={error} />}

            {/* La reputación, como la ve quien trabaja en la ficha del local. */}
            {profile &&
              (conHistoria ? (
                <div className="flex items-end gap-3.5">
                  {hasRating(profile.rating) ? (
                    <>
                      <p className="perfil-numero">
                        <span className="sr-only">Calificación: </span>
                        {formatRating(profile.rating)}
                      </p>
                      <div className="min-w-0 pb-1">
                        <Estrellas valor={profile.rating} size={17} />
                        <p className="mt-1 text-sm text-ink-soft">
                          {plural(profile.events_published, "turno publicado", "turnos publicados")}
                          {conPagos && <> · pago a tiempo {formatPunctuality(profile.on_time_payment_rate)}</>}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="perfil-numero">{profile.events_published}</p>
                      <div className="min-w-0 pb-1">
                        <p className="text-fila font-semibold text-ink">
                          {profile.events_published === 1 ? "turno publicado" : "turnos publicados"}
                        </p>
                        {conPagos && (
                          <p className="mt-0.5 text-sm text-ink-soft">
                            pago a tiempo {formatPunctuality(profile.on_time_payment_rate)}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-fila font-semibold text-ink-soft">
                  Tu reputación arranca con tu primer turno.
                </p>
              ))}

            {/* Sin reseñas no se muestra nada (sobrecarga visual, 2026-09-30). */}
            <ReceivedReviews suave />

            {/* La verificación va arriba mientras no está aprobada: es lo que
                destraba todo. Aprobada, el sello es el chip de arriba y la
                nota baja al final de la columna. Es una sola tarjeta que
                cambia de orden, no dos: montarla en dos lugares la hacía
                saltar y pedir dos veces el estado (revisión del 2026-11-21). */}
            <div className={`caja-suave ${verificado ? "order-last" : ""}`}>
              <BusinessVerificationCard onVerifiedChange={setVerificado} />
            </div>

            {/* Sólo con al menos una: en cero no dibuja nada. */}
            {profile && <LateCancellations suave count={profile.late_cancellations ?? 0} />}
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:col-span-2 lg:mt-0">
            <FilasSuaves>
              <FilaSuave href="/profile/edit">Datos del comercio</FilaSuave>
              <FilaSuave href="/subscription">Mi plan</FilaSuave>
              <FilaSuave href="/favorites">Trabajadores favoritos</FilaSuave>
              <FilaSuave href="/profile/settings">Ajustes</FilaSuave>
            </FilasSuaves>

            {/* Quién está a cargo: el nombre de la cuenta (se edita acá) y su
                mail. Lo ve quien trabaja como «A cargo de …». */}
            <div className="px-1">
              <p className="text-caption font-semibold text-ink-soft">A cargo</p>
              <EditableName className="text-fila font-semibold text-ink" />
              <p className="truncate text-sm text-ink-soft">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
