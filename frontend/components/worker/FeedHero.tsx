"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatShiftWhen } from "@/lib/datetime";
import { formatPayShort } from "@/lib/pay";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { ChevronRightIcon, ClockIcon, FlameIcon, StarIcon, WalletIcon } from "@/components/icons";
import { shiftHeroPhoto } from "@/lib/company-photo";

/**
 * Tarjeta "Recomendado" del home del trabajador (board de Julieta, pantalla 1):
 * el primer turno del feed, grande, con la foto del local de fondo. Sin foto,
 * el fondo es el verde bosque de la marca (`bg-secondary`) con el ícono del
 * rubro de marca de agua — nunca el gradiente saturado por rubro: el home es
 * blanco y el color levanta con criterio, no por toda la pantalla.
 *
 * Link "estirado": el <a> cubre toda la tarjeta y el contenido va encima con
 * `pointer-events-none`, salvo el botón de guardar. Así la tarjeta entera abre
 * el detalle sin meter un <button> adentro de un <a> (HTML inválido).
 */
export default function FeedHero({ shift }: { shift: Shift }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon } = SKILL_ACCENT[shift.position];
  const label = SKILL_LABELS[shift.position];
  const where = [shift.company_name, shift.city].filter(Boolean).join(" · ");

  return (
    <article
      data-testid="feed-hero-card"
      className="relative flex h-[232px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-secondary shadow-[var(--shadow-float)] transition active:scale-[0.99]"
    >
      {hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard */}
          <img
            src={cldThumb(heroPhoto, 800)}
            alt=""
            onError={() => setBroken(true)}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        </>
      ) : (
        <Icon size={150} className="absolute -right-6 -top-6 text-white/10" aria-hidden />
      )}

      <Link
        href={`/turno/${shift.id}`}
        aria-label={`Ver turno: ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />

      <div className="pointer-events-none relative z-[2] flex items-start justify-between gap-2 p-3.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-night">
          <StarIcon size={11} /> Recomendado
        </span>
        <div className="flex items-center gap-2">
          {shift.urgent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-danger-text">
              <FlameIcon size={12} /> Urgente
            </span>
          )}
          <span className="pointer-events-auto">
            <SaveShiftButton shiftId={shift.id} />
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-[2] flex items-end justify-between gap-3 px-4 pb-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[28px] font-medium leading-tight text-white">{label}</h2>
          {where && <p className="mt-0.5 truncate text-sm text-white/85">{where}</p>}
          <div className="mt-2 space-y-1 text-[13px] text-white/90">
            <p className="flex items-center gap-1.5">
              <ClockIcon size={14} className="shrink-0 text-white/70" />
              {formatShiftWhen(shift.start_at, shift.end_at)}
            </p>
            <p className="flex items-center gap-1.5 font-semibold text-white">
              <WalletIcon size={14} className="shrink-0 text-white/70" />
              {formatPayShort(shift)}
            </p>
          </div>
        </div>
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-night"
        >
          <ChevronRightIcon size={18} />
        </span>
      </div>
    </article>
  );
}
