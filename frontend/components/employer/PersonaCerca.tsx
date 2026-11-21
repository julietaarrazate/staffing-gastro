"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, WorkerMapResult } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatAgo } from "@/lib/datetime";
import { formatDistance } from "@/lib/format";
import RatingOrNew from "@/components/RatingOrNew";
import { Estrellas } from "@/components/profile/ProfileParts";
import { formatRating, hasRating } from "@/lib/reputation";

/**
 * La foto de quien aparece en Buscar del comercio: redonda; sin foto (o si no
 * carga), la inicial sobre el cielo de `.portada-cielo` (dirección suave,
 * ADR-0028). Reemplaza al cuadradito de color por rubro (`heroTile`).
 */
export function FotoPersona({ nombre, url, className = "" }: { nombre: string; url: string | null; className?: string }) {
  const [rota, setRota] = useState(false);
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`persona-foto relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ${className}`}>
      {url && !rota ? (
        // eslint-disable-next-line @next/next/no-img-element -- la foto viene de Cloudinary ya optimizada
        <img
          src={url}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          onError={() => setRota(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden className="portada-cielo flex h-full w-full items-center justify-center text-xl font-extrabold">
          {inicial}
        </span>
      )}
    </span>
  );
}

/**
 * Una persona en la lista de Buscar del comercio (hoja del celular y panel de
 * la compu): fila suave como las de `TurnoMapa` en `/map`. La foto, el nombre,
 * la nota con la distancia, «Disponible ahora · hace N» en verde y los rubros
 * como `chip-suave`. Toda la fila lleva a la ficha.
 *
 * El nombre y el «Disponible ahora» comparten el mismo contenedor (el que
 * pasa al lector de pantalla y los specs).
 */
export default function PersonaCerca({ worker }: { worker: WorkerMapResult }) {
  return (
    <Link
      href={`/workers/${worker.profile_id}`}
      className="mapa-turno persona-fila flex items-start gap-3 p-3 transition active:scale-[0.99]"
    >
      <FotoPersona nombre={worker.full_name} url={worker.photo_url} />
      <div className="min-w-0 flex-1">
        <p lang="es" className="break-words text-base font-extrabold leading-tight tracking-[-0.01em] text-ink">
          {worker.full_name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {/* Las estrellas en el azul de los links (`Estrellas` del Perfil), no
              las ámbar de `RatingOrNew`: esta pantalla no lleva ámbar. */}
          {hasRating(worker.rating) ? (
            <>
              <Estrellas valor={worker.rating} size={13} />
              <span className="text-xs font-medium text-ink-soft">{formatRating(worker.rating)}</span>
            </>
          ) : (
            <RatingOrNew rating={worker.rating} numberClassName="text-xs font-medium text-ink-soft" />
          )}
          {worker.distance_km != null && (
            <span className="text-xs font-medium text-ink-soft">· {formatDistance(worker.distance_km)}</span>
          )}
        </div>
        {worker.is_live && (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-success-text">
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
            Disponible ahora
            {worker.position_updated_at && (
              <span className="font-medium text-ink-soft">· {formatAgo(worker.position_updated_at)}</span>
            )}
          </p>
        )}
        {worker.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {worker.skills.map((sk) => {
              const { Icon } = SKILL_ACCENT[sk];
              return (
                <span key={sk} className="chip-suave persona-rubro">
                  <Icon size={11} /> {SKILL_LABELS[sk]}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}
