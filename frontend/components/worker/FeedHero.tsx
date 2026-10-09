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
 * el fondo es el color de marca (`bg-secondary`, celeste claro) con el ícono del
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
  // Con foto, letra blanca sobre el degradé negro; sin foto va sobre la
  // marca, que con la paleta celeste es clara: `on-brand` (tinta).
  const ink = hasPhoto
    ? { strong: "text-white", soft: "text-white/85", softer: "text-white/90", icon: "text-white/70" }
    : { strong: "text-on-brand", soft: "text-on-brand/85", softer: "text-on-brand/90", icon: "text-on-brand/70" };

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
        <Icon size={150} className="absolute -right-6 -top-6 text-on-brand/10" aria-hidden />
      )}

      <Link
        href={`/turno/${shift.id}`}
        aria-label={`Ver turno: ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />

      <div className="pointer-events-none relative z-[2] flex items-start justify-between gap-2 p-3.5">
        {/* Una sola insignia (2026-09-28, diagnóstico de sobrecarga): antes
            iban "Recomendado" y "Urgente" juntas, más el guardar. Si el turno
            es urgente, eso es lo que decide y va solo; si no, "Recomendado". */}
        {shift.urgent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-label font-bold text-danger-text">
            <FlameIcon size={12} /> Urgente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-label font-bold text-night">
            <StarIcon size={11} /> Recomendado
          </span>
        )}
        <span className="pointer-events-auto">
          <SaveShiftButton shiftId={shift.id} />
        </span>
      </div>

      <div className="pointer-events-none relative z-[2] flex items-end justify-between gap-3 px-4 pb-4">
        <div className="min-w-0">
          <h2 className={`truncate font-display text-h1 font-medium ${ink.strong}`}>{label}</h2>
          {where && <p className={`mt-0.5 truncate text-sm ${ink.soft}`}>{where}</p>}
          <div className={`mt-2 space-y-1 text-caption ${ink.softer}`}>
            <p className="flex items-center gap-1.5">
              <ClockIcon size={14} className={`shrink-0 ${ink.icon}`} />
              {formatShiftWhen(shift.start_at, shift.end_at)}
            </p>
            <p className={`flex items-center gap-1.5 font-semibold ${ink.strong}`}>
              <WalletIcon size={14} className={`shrink-0 ${ink.icon}`} />
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
