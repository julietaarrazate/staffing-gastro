"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { WorkerProfile } from "@/lib/types";
import { Avatar, Button, ErrorBanner, Skeleton } from "@/components/ui";
import FichaTrabajadorContenido from "@/components/profile/FichaTrabajadorContenido";
import { CheckIcon } from "@/components/icons";
import { firstNameOf } from "@/lib/shift-next-step";

/**
 * La ficha de la persona elegida en la lista, al lado de Candidatos en la
 * compu (renglón 2 de `docs/planning/ESCRITORIO_PANTALLAS.md`). Cuenta lo
 * mismo que `/workers/[id]` (`FichaTrabajadorContenido`) y es donde va
 * «Elegir a <nombre>», el único ámbar de la pantalla: se decide mirando a la
 * persona, sin ir y volver. «Ver ficha completa» abre la pantalla entera.
 *
 * No decide a quién se puede elegir ni qué pasa al hacerlo: eso es de
 * Candidatos (`onElegir`, `bloqueado`).
 */
export default function FichaCandidato({
  perfilId,
  nombre,
  foto,
  token,
  onElegir,
  faltaVerificar = false,
  eligiendo = false,
  bloqueado = false,
}: {
  perfilId: string;
  nombre: string;
  foto: string | null;
  token: string | null | undefined;
  /** Sin esto no hay botón: el turno ya no admite elegir. */
  onElegir?: () => void;
  /** No verificó su identidad y hace falta para elegirla. */
  faltaVerificar?: boolean;
  eligiendo?: boolean;
  bloqueado?: boolean;
}) {
  const [perfil, setPerfil] = useState<{ id: string; datos: WorkerProfile } | null>(null);
  const [error, setError] = useState<{ id: string; mensaje: string } | null>(null);

  // El pedido en curso: al cambiar de persona (o reintentar) se descarta el
  // anterior, también el de un «Reintentar».
  const cancelarAnterior = useRef<() => void>(() => {});
  const cargar = useCallback(() => {
    cancelarAnterior.current();
    if (!token) return () => {};
    let cancelado = false;
    setError(null);
    api
      .get<WorkerProfile>(`/workers/${perfilId}`, token)
      .then((datos) => {
        if (!cancelado) setPerfil({ id: perfilId, datos });
      })
      .catch((err) => {
        if (!cancelado) setError({ id: perfilId, mensaje: getErrorMessage(err, "No se pudo cargar la ficha") });
      });
    const cancelar = () => {
      cancelado = true;
    };
    cancelarAnterior.current = cancelar;
    return cancelar;
  }, [perfilId, token]);

  useEffect(() => {
    const cancelar = cargar();
    return () => {
      cancelar();
      cancelarAnterior.current();
    };
  }, [cargar]);

  // Mientras llega la ficha de otra persona no se muestra la anterior.
  const datos = perfil?.id === perfilId ? perfil.datos : null;
  const falla = error?.id === perfilId ? error.mensaje : null;

  return (
    <aside
      data-testid="ficha-candidato"
      aria-label={`Ficha de ${nombre}`}
      className="flex flex-col"
    >
      <div className="flex items-center gap-4">
        <Avatar src={datos?.photo_url ?? foto} name={nombre} id={perfilId} size="xl" cielo />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-[length:var(--text-pantalla)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
            {datos?.age != null ? `${nombre}, ${datos.age}` : nombre}
          </h2>
          {datos?.city && <p className="mt-1 break-words text-fila font-semibold text-ink-soft">{datos.city}</p>}
          {datos?.identidad_verificada && (
            <span className="chip-suave mt-2 text-success-text">
              <CheckIcon size={14} strokeWidth={2.6} aria-hidden />
              Identidad verificada
            </span>
          )}
        </div>
      </div>

      {faltaVerificar && (
        <p data-testid="falta-verificar-candidato" className="mt-5 rounded-2xl bg-surface-2 px-4 py-3 text-center text-small text-ink-soft">
          Todavía no verificó su identidad. Cuando lo haga vas a poder elegirla.
        </p>
      )}
      {onElegir && !faltaVerificar && (
        <Button
          fullWidth
          size="lg"
          onClick={onElegir}
          loading={eligiendo}
          disabled={bloqueado}
          className="mt-5 h-auto whitespace-normal break-words py-3 text-center"
        >
          Elegir a {firstNameOf(nombre) ?? nombre}
        </Button>
      )}

      <div className="mt-6 border-t border-line pt-6">
        {falla ? (
          <ErrorBanner message={falla} onRetry={() => cargar()} />
        ) : datos ? (
          <FichaTrabajadorContenido profile={datos} workerId={perfilId} token={token} esComercio />
        ) : (
          <div aria-hidden>
            <Skeleton className="h-16 w-56" />
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-5 h-40 w-full rounded-[18px]" />
          </div>
        )}
      </div>

      <Link
        href={`/workers/${perfilId}`}
        className="mt-5 flex min-h-11 items-center justify-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
      >
        Ver ficha completa
      </Link>
    </aside>
  );
}
