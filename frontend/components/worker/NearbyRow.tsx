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
  const donde = [shift.company_name, distanceKm != null ? formatDistance(distanceKm) : null, formatShiftWhenLive(shift)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      {/* Una tecla suave (ADR-0028): blanca, sin filete, con sombra difusa. */}
      <Link
        href={`/turno/${shift.id}`}
        data-testid="feed-nearby-card"
        className="tecla flex items-center gap-3 py-2.5 pl-2.5 pr-4"
      >
        {/* Sin foto: el TINTE pálido del rubro y su ícono, el color como
            acento y no como banda saturada. */}
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${hasPhoto ? "bg-surface" : `rubro-tile ${bg}`}`}
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard
            <img
              src={cldThumb(heroPhoto, 160)}
              alt=""
              width={48}
              height={48}
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
        <span className="min-w-0 flex-1">
          {/* El puesto no se corta: es lo primero que se lee. «Urgente» va al
              lado y, si no entra, baja de renglón en vez de comerse el puesto. */}
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-fila font-bold text-ink">{SKILL_LABELS[shift.position]}</span>
            {shift.urgent && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-caption font-bold text-danger-text">
                <FlameIcon size={11} /> Urgente
              </span>
            )}
          </span>
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
            <span className="truncate">{donde}</span>
          </span>
        </span>
        <span className="shrink-0 text-lg font-extrabold tabular-nums text-ink">{formatPayCompact(shift)}</span>
      </Link>
    </li>
  );
}

/** "Cerca tuyo" del home: una lista de teclas suaves, ordenada como el resto
 *  del feed. Cada renglón trae la foto del local (o el ícono del rubro), el
 *  puesto, dónde y cuándo, y la paga a la derecha. "Ver todos" lleva a la
 *  lista completa de /buscar. Hasta el 2026-11-19 eran renglones planos con
 *  filete fino. */
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
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-h3 font-bold text-ink">{title}</h2>
        <Link
          href="/buscar"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-cielo-text"
        >
          Ver todos <ChevronRightIcon size={15} />
        </Link>
      </div>
      <ul className="space-y-2.5">
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
