"use client";

import Link from "next/link";
import { Avatar, Button } from "@/components/ui";
import { ChevronRightIcon, ShieldIcon, StarIcon, XCircleIcon } from "@/components/icons";
import { datosCandidato, type CandidateSignals } from "./CandidateSignals";

/**
 * Una persona de la lista de Candidatos que no es la destacada (dirección
 * suave, ADR-0028): una fila que se toca. La foto, el nombre y sus datos en
 * un renglón llevan al perfil; a la derecha, «Elegir» (liso: el ámbar es de
 * la destacada). Sin poder elegir, la flecha del perfil.
 */
export default function CandidatoFila({
  perfilId,
  nombre,
  foto,
  verificada,
  signals,
  disponible = false,
  marca,
  onElegir,
  eligiendo = false,
  bloqueado = false,
}: {
  perfilId: string;
  nombre: string;
  foto: string | null;
  verificada: boolean;
  signals: CandidateSignals;
  /** Prendió «Disponible» (sólo postulantes). */
  disponible?: boolean;
  /** Tuvo este turno y lo dejó: «Rechazó este turno», «Canceló»… */
  marca?: string | null;
  onElegir?: () => void;
  eligiendo?: boolean;
  bloqueado?: boolean;
}) {
  const datos = datosCandidato(signals);
  return (
    // Si «Elegir» no entra al lado (letra muy grande en un celular chico),
    // baja a su renglón: el nombre nunca queda en una columna de una letra.
    <div data-fila-candidato className="tecla no-select flex min-w-0 flex-wrap items-center justify-end gap-2 p-2.5 pr-3">
      <Link
        href={`/workers/${perfilId}`}
        className="flex min-w-[min(100%,11rem)] flex-1 items-center gap-3 rounded-[14px]"
      >
        <Avatar src={foto} name={nombre} />
        <span className="block min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span data-nombre-candidato className="min-w-0 truncate text-[length:var(--text-fila)] font-bold text-ink">
              {nombre}
            </span>
            {verificada && (
              <span role="img" aria-label="Identidad verificada" title="Identidad verificada" className="shrink-0 text-trust-text">
                <ShieldIcon size={14} />
              </span>
            )}
          </span>
          {marca && (
            <span
              data-testid="postulante-desasignado"
              className="mt-0.5 flex items-center gap-1.5 text-caption font-semibold text-ink-soft"
            >
              <XCircleIcon size={13} className="shrink-0" />
              {marca}
            </span>
          )}
          <span className="mt-0.5 block text-caption leading-snug text-ink-soft">
            {disponible && !marca && (
              <>
                <span className="font-semibold text-success-text">Disponible</span>
                {datos.length > 0 && " · "}
              </>
            )}
            {datos.map((d, i) => (
              <span key={d.clave}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">
                  {d.clave === "nota" && (
                    <>
                      <StarIcon size={12} filled className="mr-0.5 inline-block -translate-y-px text-primary-text" />
                      <span className="sr-only">Calificación </span>
                    </>
                  )}
                  {d.clave === "distancia" ? d.texto.toLowerCase() : d.texto}
                </span>
              </span>
            ))}
          </span>
        </span>
      </Link>
      {onElegir ? (
        <Button
          size="sm"
          variant="surface"
          onClick={onElegir}
          loading={eligiendo}
          disabled={bloqueado}
          aria-label={`Elegir a ${nombre}`}
          className="boton-quieto min-h-[44px] shrink-0"
        >
          Elegir
        </Button>
      ) : (
        <ChevronRightIcon size={18} className="shrink-0 text-ink-mute" aria-hidden />
      )}
    </div>
  );
}
