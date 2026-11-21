"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { reportCompanyHref } from "@/lib/support-reference";
import { CompanyProfile } from "@/lib/types";
import { cldThumb } from "@/lib/cloudinary";
import { ErrorBanner, Skeleton } from "@/components/ui";
import FichaSuave from "@/components/profile/FichaSuave";
import { DatoSuave, FilasSuaves, ReputacionGrande } from "@/components/profile/ProfileParts";
import { formatPunctuality, hasPaymentRate, hasRating, NEW_LABEL } from "@/lib/reputation";
import MiniMap from "@/components/MiniMap";
import { RouteIcon } from "@/components/icons";
import { plural } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafeteria: "Cafetería",
  salon_eventos: "Salón de eventos",
  catering: "Catering",
  empresa_gastronomica: "Empresa gastronómica",
};

/** El esqueleto de la hoja: la reputación, unas líneas y las filas de datos. */
function EsqueletoHoja() {
  return (
    <div aria-hidden>
      <Skeleton className="h-16 w-56" />
      <Skeleton className="mt-5 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-5 h-32 w-full rounded-[18px]" />
    </div>
  );
}

/**
 * La ficha pública del comercio, con la dirección suave (ADR-0028): lo mismo
 * que el comercio ve en su propio perfil (`company/PerfilComercio`), visto
 * desde afuera. Sólo cambia la piel: los datos, y a quién se muestran, son los
 * de antes («Reportar un problema» sólo para quien trabaja).
 */
export default function PublicCompanyProfilePage() {
  const { token, user } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Una foto del local que no carga se esconde (el logo, en cambio, vuelve a la inicial).
  const [portadaRota, setPortadaRota] = useState(false);
  // Sin historial (entrada directa, notificación, pestaña nueva) `back()` no
  // hace nada: se cae a Buscar, el origen razonable de quien trabaja.
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/search");
  };

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<CompanyProfile>(`/companies/${params.id}`, token)
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

  const hasCoords = profile.latitude != null && profile.longitude != null;
  const rubro = profile.category ? (CATEGORY_LABELS[profile.category] ?? profile.category) : null;
  const bajada = [rubro, profile.city || null].filter(Boolean).join(" · ");
  const conPagos = hasPaymentRate(profile.payments_recorded, profile.events_published);
  const conHistoria = profile.events_published > 0 || hasRating(profile.rating);
  const hayDatos = profile.capacity != null || Boolean(profile.opening_hours) || Boolean(profile.address);

  return (
    <FichaSuave
      titulo={profile.name}
      bajada={bajada || undefined}
      fotoUrl={profile.logo_url}
      inicial={profile.name}
      onVolver={goBack}
    >
      {profile.cover_photo_url && !portadaRota && (
        // eslint-disable-next-line @next/next/no-img-element -- foto del local, ancho de la hoja
        <img
          src={cldThumb(profile.cover_photo_url, 800)}
          alt={profile.name}
          loading="lazy"
          decoding="async"
          onError={() => setPortadaRota(true)}
          className="mb-6 h-44 w-full rounded-[20px] object-cover md:h-56"
        />
      )}

      {/* Con coordenadas, la ubicación (mapa y «Cómo llegar») pasa a la columna
          de al lado en lg+: es lo que hace falta para decidir si conviene ir
          (Julieta, 2026-07-29). Sin ellas no hay contenido para una segunda
          columna y no se fuerza la grilla. */}
      <div className={hasCoords ? "lg:grid lg:grid-cols-5 lg:items-start lg:gap-10" : "lg:max-w-2xl"}>
        <div className="flex flex-col gap-5 lg:col-span-3">
          <ReputacionGrande
            rating={profile.rating}
            cantidad={profile.events_published}
            singular="turno publicado"
            varios="turnos publicados"
            detalle={conPagos ? `pago a tiempo ${formatPunctuality(profile.on_time_payment_rate)}` : null}
            conHistoria={conHistoria}
            mostrarCantidad={profile.events_published > 0}
            vacio={
              <div>
                <p className="text-fila font-semibold text-ink-soft">{NEW_LABEL}</p>
                {/* Pagos registrados sin turnos publicados: «pago a tiempo» se
                    muestra igual, como antes (`hasPaymentRate`). */}
                {conPagos && (
                  <p className="mt-0.5 text-sm text-ink-soft">
                    pago a tiempo {formatPunctuality(profile.on_time_payment_rate)}
                  </p>
                )}
              </div>
            }
          />

          {profile.owner_full_name && (
            <p className="text-sm text-ink-soft">A cargo de {profile.owner_full_name}</p>
          )}

          {profile.description && <p className="break-words text-base text-ink">{profile.description}</p>}

          {hayDatos && (
            <FilasSuaves as="dl">
              {profile.capacity != null && (
                <DatoSuave nombre="Capacidad" valor={plural(profile.capacity, "persona", "personas")} />
              )}
              {profile.opening_hours && <DatoSuave largo nombre="Horario" valor={profile.opening_hours} />}
              {profile.address && <DatoSuave largo nombre="Dirección" valor={profile.address} />}
            </FilasSuaves>
          )}
        </div>

        {hasCoords && (
          <section aria-labelledby="ubicacion" className="mt-7 lg:col-span-2 lg:mt-0">
            <h2 id="ubicacion" className="px-1 text-caption font-semibold text-ink-soft">
              Ubicación
            </h2>
            <MiniMap
              latitude={profile.latitude as number}
              longitude={profile.longitude as number}
              className="mt-2 h-40 w-full !rounded-[20px]"
            />
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${profile.latitude},${profile.longitude}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="boton boton-hondo mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 px-5 py-2 text-sm font-semibold transition active:scale-[0.98]"
            >
              <RouteIcon size={16} /> Cómo llegar
            </button>
          </section>
        )}
      </div>

      {/* U110: discreto, sin acento. */}
      {user?.role === "worker" && (
        <p className="mt-8 text-center">
          <Link
            href={reportCompanyHref(profile.id)}
            className="text-sm font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            Reportar un problema
          </Link>
        </p>
      )}
    </FichaSuave>
  );
}
