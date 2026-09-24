"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatShiftWhen } from "@/lib/datetime";
import { formatPayAmount } from "@/lib/pay";
import { ChevronRightIcon, FlameIcon } from "@/components/icons";
import { shiftHeroPhoto } from "@/lib/company-photo";

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function NearbyItem({ shift, distanceKm }: { shift: Shift; distanceKm: number | null }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const where = [shift.company_name, distanceKm != null ? formatDistance(distanceKm) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/turno/${shift.id}`}
      data-testid="feed-nearby-card"
      className="w-[156px] shrink-0 snap-start transition active:scale-[0.98]"
    >
      {/* Sin foto: tile con el TINTE pálido del rubro y su ícono — el color
          como acento, no como banda saturada. */}
      <div
        className={`relative h-[104px] overflow-hidden rounded-[var(--radius-chip)] ring-1 ring-line ${hasPhoto ? "bg-surface" : `rubro-tile ${bg}`}`}
      >
        {hasPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard */}
            <img
              src={cldThumb(heroPhoto, 360)}
              alt=""
              onError={() => setBroken(true)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          <span className={`rubro-tile-icon flex h-full w-full items-center justify-center ${fg}`}>
            <Icon size={30} />
          </span>
        )}
        {shift.urgent && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-card px-1.5 py-0.5 text-label font-bold text-danger-text shadow-sm">
            <FlameIcon size={10} /> Urgente
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{SKILL_LABELS[shift.position]}</p>
      {where && <p className="truncate text-xs text-ink/55">{where}</p>}
      <p className="mt-0.5 truncate text-xs text-ink/55">{formatShiftWhen(shift.start_at, shift.end_at)}</p>
      <p className="mt-0.5 text-sm font-bold text-primary-text">{formatPayAmount(shift)}</p>
    </Link>
  );
}

/** Fila "Cerca tuyo" del home (board de Julieta, pantalla 1): miniaturas en
 *  scroll horizontal, ordenadas como el resto del feed. "Ver todos" lleva a la
 *  lista completa de /buscar. */
export default function NearbyRow({
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
      {/* `scroll-px-4`: el snap alinea contra el borde del scroller e ignora
          el padding; sin scroll-padding la primera miniatura quedaba pegada
          al borde de la pantalla, fuera del margen de 16px. */}
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {shifts.map((shift) => (
          <NearbyItem key={shift.id} shift={shift} distanceKm={distanceOf(shift)} />
        ))}
      </div>
    </section>
  );
}
