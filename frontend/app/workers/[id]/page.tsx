"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { WorkerProfile } from "@/lib/types";
import { ErrorBanner, Skeleton } from "@/components/ui";
import FichaSuave from "@/components/profile/FichaSuave";
import FichaTrabajadorContenido from "@/components/profile/FichaTrabajadorContenido";
import { CheckIcon } from "@/components/icons";

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

  return (
    <FichaSuave
      titulo={profile.age != null ? `${name}, ${profile.age}` : name}
      bajada={profile.city ?? undefined}
      fotoUrl={profile.photo_url}
      inicial={name}
      idFoto={params.id}
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
          asignar. Lo que se cuenta es de `FichaTrabajadorContenido`. */}
      <FichaTrabajadorContenido
        profile={profile}
        workerId={params.id}
        token={token}
        esComercio={user?.role === "employer"}
        enColumnas
      />
    </FichaSuave>
  );
}
