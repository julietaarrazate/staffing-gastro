"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { formatShiftWhen, isTodayInArgentina } from "@/lib/datetime";
import { formatPayShort } from "@/lib/pay";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { Apunte, Badge, Comanda, ComandaFila, textoCartel } from "@/components/ui";
import { shiftHeroPhoto } from "@/lib/company-photo";

/**
 * El turno recomendado del Inicio del trabajador: el primero del feed, como
 * una comanda de papel (dirección «con relieve», 2026-11-18). El puesto va en
 * brocha, el local y el barrio debajo, y dos renglones con filete: cuándo y
 * cuánto. Es el único objeto con relieve de la pantalla.
 *
 * Hasta el 2026-11-18 era una tarjeta de 232 px con la foto del local de
 * fondo y la letra en blanco sobre un degradé. La foto sigue, chica, al lado
 * del puesto: sin foto va el ícono del rubro sobre su tinte.
 *
 * Un solo aviso arriba a la derecha: si el turno es urgente, el sello
 * «Urgente»; si no y es para hoy, el apunte a mano «para hoy». Antes iba una
 * insignia «Recomendado»: ahora lo dice el título de la sección, «Para vos».
 *
 * Link "estirado": el <a> cubre toda la comanda y el contenido va encima con
 * `pointer-events-none`, salvo el botón de guardar. Así la comanda entera abre
 * el detalle sin meter un <button> adentro de un <a> (HTML inválido).
 */
function FeedHero({ shift }: { shift: Shift }) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const label = SKILL_LABELS[shift.position];
  const where = [shift.company_name, shift.city].filter(Boolean).join(" · ");
  const aviso = shift.urgent ? (
    <span className="sello-goma shrink-0 text-danger-text">Urgente</span>
  ) : isTodayInArgentina(shift.start_at) ? (
    <Apunte className="mr-1 shrink-0">para hoy</Apunte>
  ) : null;

  return (
    <Comanda
      as="article"
      data-testid="feed-hero-card"
      className="transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 motion-reduce:transition-none"
    >
      <Link
        href={`/turno/${shift.id}`}
        aria-label={`Ver turno: ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />

      <div className="pointer-events-none relative z-[2] px-4 pb-3 pt-4">
        <div className="flex items-start gap-3">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb), igual que OpportunityCard
            <img
              src={cldThumb(heroPhoto, 200)}
              alt=""
              onError={() => setBroken(true)}
              loading="eager"
              decoding="async"
              className="h-16 w-16 shrink-0 rounded-[var(--radius-btn)] object-cover"
            />
          ) : (
            <span
              aria-hidden
              className={`rubro-tile flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-btn)] ${bg}`}
            >
              <span className={`rubro-tile-icon ${fg}`}>
                <Icon size={28} />
              </span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="letra-cartel letra-cartel-puesto break-words">{textoCartel(label)}</h3>
            {where && <p className="mt-1 text-sm text-ink-soft">{where}</p>}
          </div>
        </div>

        {/* Un renglón para los avisos: a la izquierda el sello de confianza
            (ADR-0011 / G5, el mismo de `ShiftCard` y `OpportunityCard`); a la
            derecha, «Urgente» o «para hoy». Al lado del puesto no entraban. */}
        {(shift.company_verified || aviso) && (
          <div className="mt-2.5 flex min-h-7 items-center justify-between gap-3">
            {shift.company_verified ? (
              <Badge tone="trust" icon={<ShieldIcon size={11} />}>
                Comercio verificado
              </Badge>
            ) : (
              <span />
            )}
            {aviso}
          </div>
        )}

        <dl className="mt-3">
          <ComandaFila rotulo="Cuándo">{formatShiftWhen(shift.start_at, shift.end_at)}</ComandaFila>
          <ComandaFila rotulo="Pago">{formatPayShort(shift)}</ComandaFila>
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
          <span aria-hidden className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary-text">
            Ver el turno <ChevronRightIcon size={15} />
          </span>
          <span className="pointer-events-auto">
            <SaveShiftButton shiftId={shift.id} />
          </span>
        </div>
      </div>
    </Comanda>
  );
}

// Memo: el feed se re-renderiza al tocar "Disponible" y otros controles que
// no cambian sus datos (medido 2026-10-22).
export default memo(FeedHero);
