"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { cldThumb } from "@/lib/cloudinary";
import { formatShiftWhenLive, isTodayInArgentina } from "@/lib/datetime";
import { payView } from "@/lib/pay";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { shiftHeroPhoto } from "@/lib/company-photo";

/**
 * El turno recomendado del Inicio del trabajador: el primero del feed, como
 * una tarjeta suave (dirección «suave», ADR-0028, 2026-11-19). Arriba la foto
 * del local (si hay) con los avisos como chips blancos encima («Urgente» o
 * «Para hoy»); abajo el puesto, el pago bien grande a la derecha, el local y
 * cuándo. Sin foto es la misma tarjeta sin la franja, y los avisos pasan a
 * chips arriba del puesto. Hasta el 2026-11-19 era una comanda de papel.
 *
 * Link "estirado": el <a> cubre toda la tarjeta y el contenido va encima con
 * `pointer-events-none`, salvo el botón de guardar. Así la tarjeta entera abre
 * el detalle sin meter un <button> adentro de un <a> (HTML inválido).
 */
function FeedHero({ shift }: { shift: Shift }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const label = SKILL_LABELS[shift.position];
  const where = [shift.company_name, shift.city].filter(Boolean).join(" · ");
  const pago = payView(shift);
  const hoy = !shift.urgent && isTodayInArgentina(shift.start_at);
  const hayAviso = shift.urgent || hoy;

  return (
    <article
      data-testid="feed-hero-card"
      className="pedido-tarjeta relative transition-transform duration-100 active:scale-[0.99] motion-reduce:transition-none"
    >
      <Link
        href={`/turno/${shift.id}`}
        aria-label={`Ver turno: ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />

      <div className="pointer-events-none relative z-[2]">
        {hasPhoto && (
          <div className="relative h-[104px] bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard */}
            <img
              src={cldThumb(heroPhoto, 800)}
              alt=""
              width={400}
              height={104}
              onError={() => setBroken(true)}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover object-[50%_40%]"
            />
            {hayAviso && (
              <div className="absolute left-3 top-3 flex gap-1.5">
                {shift.urgent ? (
                  <span className="chip-foto chip-foto-urgente">Urgente</span>
                ) : (
                  <span className="chip-foto">Para hoy</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="px-4 pb-3 pt-3.5">
          {/* Sin foto, los avisos van acá, como chips de la hoja. */}
          {!hasPhoto && hayAviso && (
            <div className="mb-2 flex gap-1.5">
              {shift.urgent ? (
                <span className="chip-suave chip-urgente">Urgente</span>
              ) : (
                <span className="chip-suave">Para hoy</span>
              )}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 break-words text-puesto font-extrabold leading-tight tracking-[-0.01em] text-ink">
              {label}
            </h3>
            <p className="shrink-0 text-right text-pago font-extrabold leading-none tabular-nums text-ink">
              {pago.amount}
            </p>
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm text-ink-soft">
              {where && <p className="break-words">{where}</p>}
              <p>{formatShiftWhenLive(shift)}</p>
            </div>
            {(pago.suffix || shift.tips) && (
              <p className="shrink-0 text-right text-sm text-ink-soft">
                {[pago.suffix, shift.tips ? "+ propinas" : null].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
          {shift.company_verified && (
            <div className="mt-2.5">
              <Badge tone="trust" icon={<ShieldIcon size={11} />}>
                Comercio verificado
              </Badge>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <span aria-hidden className="inline-flex items-center gap-0.5 text-sm font-semibold text-cielo-text">
              Ver el turno <ChevronRightIcon size={15} />
            </span>
            <span className="pointer-events-auto">
              <SaveShiftButton shiftId={shift.id} className="!h-11 !w-11 !bg-[var(--suave-campo)] !shadow-none" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

// Memo: el feed se re-renderiza al tocar "Disponible" y otros controles que
// no cambian sus datos (medido 2026-10-22).
export default memo(FeedHero);
