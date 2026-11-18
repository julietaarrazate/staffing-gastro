"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatShiftWhenLive } from "@/lib/datetime";
import { formatPayCompact } from "@/lib/pay";
import { formatDistance } from "@/lib/format";
import { ChevronRightIcon, FlameIcon, ShieldIcon } from "@/components/icons";
import { shiftHeroPhoto } from "@/lib/company-photo";

function NearbyItem({ shift, distanceKm }: { shift: Shift; distanceKm: number | null }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const where = [shift.company_name, distanceKm != null ? formatDistance(distanceKm) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-b border-line">
      <Link
        href={`/turno/${shift.id}`}
        data-testid="feed-nearby-card"
        className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-x-3 px-0.5 py-3 transition active:bg-surface"
      >
        {/* Sin foto: el TINTE pálido del rubro y su ícono, el color como
            acento y no como banda saturada. */}
        <span
          className={`flex h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-[var(--radius-btn)] ${hasPhoto ? "bg-surface" : `rubro-tile ${bg}`}`}
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard
            <img
              src={cldThumb(heroPhoto, 160)}
              alt=""
              onError={() => setBroken(true)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className={`rubro-tile-icon ${fg}`}>
              <Icon size={22} />
            </span>
          )}
        </span>
        <span className="min-w-0">
          {/* El puesto no se corta: es lo primero que se lee (a 320 px, con
              «Urgente» al lado, quedaba «Ayudante …»). */}
          <span className="block text-body font-semibold text-ink">{SKILL_LABELS[shift.position]}</span>
          {(where || shift.company_verified) && (
            <span className="flex items-center gap-1 text-caption text-ink-soft">
              {/* Forma compacta: sello de `company_verified` con nombre
                  accesible completo. */}
              {shift.company_verified && (
                <span
                  role="img"
                  aria-label="Comercio verificado"
                  title="Comercio verificado"
                  className="inline-flex shrink-0 text-cielo-text"
                >
                  <ShieldIcon size={13} />
                </span>
              )}
              <span className="truncate">{where}</span>
            </span>
          )}
          {/* Si «Urgente» y el horario no entran juntos (320 px), el horario
              baja de renglón: tampoco se corta. */}
          <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-ink-soft">
            {shift.urgent && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-danger-text">
                <FlameIcon size={11} /> Urgente
              </span>
            )}
            <span>{formatShiftWhenLive(shift)}</span>
          </span>
        </span>
        <span className="text-body font-bold tabular-nums text-ink">{formatPayCompact(shift)}</span>
      </Link>
    </li>
  );
}

/** "Cerca tuyo" del home: una lista con filete fino, ordenada como el resto
 *  del feed. Cada renglón trae la foto del local (o el ícono del rubro), el
 *  puesto, dónde y cuándo, y la paga a la derecha. "Ver todos" lleva a la
 *  lista completa de /buscar. Hasta el 2026-11-18 eran miniaturas de 156 px
 *  en scroll horizontal; con la dirección «con relieve» las listas van
 *  planas y el relieve queda para la comanda de arriba. */
function NearbyRow({
  shifts,
  distanceOf,
  title = "Cerca tuyo",
}: {
  shifts: Shift[];
  distanceOf: (shift: Shift) => number | null;
  title?: string;
}) {
  if (shifts.length === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        <Link
          href="/buscar"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary-text"
        >
          Ver todos <ChevronRightIcon size={15} />
        </Link>
      </div>
      <ul className="border-t border-line">
        {shifts.map((shift) => (
          <NearbyItem key={shift.id} shift={shift} distanceKm={distanceOf(shift)} />
        ))}
      </ul>
    </section>
  );
}

// Memo: el feed se re-renderiza al tocar "Disponible" y otros controles que
// no cambian sus datos (medido 2026-10-22).
export default memo(NearbyRow);
