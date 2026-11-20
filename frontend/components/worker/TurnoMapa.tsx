"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { shiftHeroPhoto } from "@/lib/company-photo";
import { formatShiftWhenLive } from "@/lib/datetime";
import { formatDistance } from "@/lib/format";
import { PortadaCielo } from "@/components/ui";

/**
 * La miniatura de un turno en el Mapa: la foto del local y, sin foto, el
 * cielo de `PortadaCielo` con el ícono del rubro (dirección suave, ADR-0028).
 * Reemplaza al cuadradito de color por rubro (`heroTile`).
 */
export function MiniaturaTurno({ shift, className = "" }: { shift: Shift; className?: string }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const { Icon } = SKILL_ACCENT[shift.position];
  return (
    <span
      className={`mapa-turno-foto relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-surface ${className}`}
    >
      {heroPhoto && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb)
        <img
          src={cldThumb(heroPhoto, 200)}
          alt=""
          width={64}
          height={64}
          onError={() => setBroken(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <PortadaCielo id={shift.id} Icon={Icon} mini />
      )}
    </span>
  );
}

/**
 * Lo que dice un turno en el Mapa (maqueta `T-Mapa`, 2026-11-20): la
 * miniatura, el puesto, el pago en grande a la derecha, el local con la
 * distancia y cuándo es, con «Urgente» al final del renglón. Lo usan la
 * tarjeta de la hoja (celular) y la fila del panel (compu) de
 * `app/map/page.tsx`; cada una pone su contenedor y sus acciones.
 *
 * El orden en el DOM es puesto, local y recién después el pago: así se lee en
 * voz alta («Mozo/a, Bar Demo, $ 45.000»).
 */
export default function TurnoMapa({
  shift,
  distanceKm,
  pago,
  titulo,
  comercioHref,
}: {
  shift: Shift;
  distanceKm: number | null;
  /** El pago ya escrito (`formatPayAmount` o `formatPayCompact`). */
  pago: string;
  /** Lo que va adentro del título: el puesto solo, o su link al detalle. */
  titulo?: ReactNode;
  /** Si el nombre del local lleva a su perfil (la tarjeta del celular). */
  comercioHref?: string;
}) {
  const comercio = shift.company_name ?? "Comercio";
  const donde = distanceKm != null ? formatDistance(distanceKm) : (shift.city ?? "");
  return (
    <div className="flex items-start gap-3">
      <MiniaturaTurno shift={shift} />
      <div className="min-w-0 flex-1">
        {/* En el DOM: puesto, local y pago (así se lee en voz alta). A la
            vista el pago va a la derecha del puesto y el local ocupa todo el
            ancho debajo. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
          {/* Un puesto largo («Ayudante de cocina») baja a un segundo
              renglón; no se corta con puntos. */}
          <h3 className="col-start-1 row-start-1 break-words text-base font-extrabold leading-tight tracking-[-0.01em] text-ink">
            {titulo ?? SKILL_LABELS[shift.position]}
          </h3>
          {/* Si no entra, se corta el nombre del local, no la distancia. */}
          <p className="col-span-2 row-start-2 mt-0.5 flex min-w-0 text-caption text-ink-soft">
            {comercioHref ? (
              <Link
                href={comercioHref}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 min-w-0 truncate font-medium"
              >
                {comercio}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{comercio}</span>
            )}
            {donde && <span className="shrink-0 whitespace-pre"> · {donde}</span>}
          </p>
          <p data-testid="mapa-pago" className="mapa-turno-pago col-start-2 row-start-1 text-ink">
            {pago}
          </p>
        </div>
        <div className="mt-1 flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 text-caption font-semibold text-ink">{formatShiftWhenLive(shift)}</p>
          {shift.urgent && <span className="chip-suave chip-urgente mapa-turno-marca ml-auto shrink-0">Urgente</span>}
        </div>
      </div>
    </div>
  );
}
