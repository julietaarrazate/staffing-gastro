"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatPayShort } from "@/lib/pay";
import { formatDuration, formatShiftWhenLive, shiftDurationMinutes } from "@/lib/datetime";
import { cldThumb } from "@/lib/cloudinary";
import { shiftHeroPhoto } from "@/lib/company-photo";
import { formatDistance } from "@/lib/format";
import { shareShift } from "@/lib/shift-share";
import { BOTON_LISO, Badge, Button, Comanda, ComandaFila, textoCartel } from "@/components/ui";
import { CloseIcon, RouteIcon, ShareIcon, ShieldIcon } from "@/components/icons";
import SaveShiftButton from "@/components/worker/SaveShiftButton";

/**
 * Un turno de Buscar como comanda de papel (dirección «con relieve», 2026-11-19):
 * el mismo objeto que el turno del Inicio, de Mis turnos y del Panel. Arriba
 * la foto chica del local, el puesto en brocha y dónde; los renglones con
 * filete (cuándo y pago); abajo las acciones de siempre: «Cómo llegar»,
 * «Compartir», «No, gracias» y «Postularme». La comanda entera lleva al
 * detalle (`/turno/[id]`) con un link real; los botones no navegan.
 */
export default function OportunidadComanda({
  shift,
  distanceKm,
  onApply,
  onPass,
  applying = false,
  locked = false,
}: {
  shift: Shift;
  distanceKm: number | null;
  onApply: () => void;
  onPass: () => void;
  applying?: boolean;
  locked?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const label = SKILL_LABELS[shift.position];
  const where = [shift.company_name, shift.city, distanceKm != null ? formatDistance(distanceKm) : null]
    .filter(Boolean)
    .join(" · ");
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const hasDirections = shift.latitude != null && shift.longitude != null;

  return (
    <Comanda as="article" data-testid="buscar-card" className="comanda-oportunidad h-full">
      <Link
        href={`/turno/${shift.id}`}
        data-testid="opportunity-card-link"
        aria-label={`Ver el turno de ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />
      <div className="pointer-events-none relative z-[2] flex h-full flex-col px-4 pb-4 pt-4">
        {/* Foto de 48 px y 10 de aire en el celular; el puesto achica la letra
            con el ancho de la comanda (`.comanda-oportunidad`): a 320 px y en
            la grilla de tres columnas «Recepcionista» se partía. */}
        <div className="flex items-start gap-2.5 sm:gap-3">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb)
            <img
              src={cldThumb(heroPhoto, 200)}
              alt=""
              onError={() => setBroken(true)}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-[var(--radius-btn)] object-cover sm:h-14 sm:w-14"
            />
          ) : (
            <span
              aria-hidden
              className={`rubro-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] sm:h-14 sm:w-14 ${bg}`}
            >
              <span className={`rubro-tile-icon ${fg}`}>
                <Icon size={26} />
              </span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="letra-cartel letra-cartel-puesto break-words">{textoCartel(label)}</h2>
            {/* `break-words`: un nombre de comercio sin espacios se salía del
                papel y ensanchaba la página a 320 px (revisión del 2026-11-19). */}
            {where && <p className="mt-1 break-words text-sm text-ink-soft">{where}</p>}
          </div>
          <span className="pointer-events-auto shrink-0">
            <SaveShiftButton shiftId={shift.id} />
          </span>
        </div>

        {(shift.company_verified || shift.urgent) && (
          <div className="mt-2.5 flex min-h-7 items-center justify-between gap-3">
            {shift.company_verified ? (
              <Badge tone="trust" icon={<ShieldIcon size={11} />}>
                Comercio verificado
              </Badge>
            ) : (
              <span />
            )}
            {shift.urgent && <span className="sello-goma sello-rojo shrink-0">Urgente</span>}
          </div>
        )}

        <dl className="mt-3">
          <ComandaFila rotulo="Cuándo">
            {formatShiftWhenLive(shift)}
            {minutes != null && <span className="font-medium text-ink-soft"> · {formatDuration(minutes)}</span>}
          </ComandaFila>
          <ComandaFila rotulo="Pago">{formatPayShort(shift)}</ComandaFila>
        </dl>

        <div className="pointer-events-auto mt-auto flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex gap-2">
            {hasDirections && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className={`${BOTON_LISO} flex-1 whitespace-nowrap px-2 text-sm sm:px-3`}
              >
                <RouteIcon size={16} /> Cómo llegar
              </button>
            )}
            <button
              type="button"
              onClick={() => shareShift(shift, `${window.location.origin}/turno/${shift.id}`)}
              className={`${BOTON_LISO} flex-1 whitespace-nowrap px-2 text-sm sm:px-3`}
            >
              <ShareIcon size={16} /> Compartir
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="No, gracias"
              onClick={onPass}
              disabled={applying || locked}
              className={`${BOTON_LISO} w-11 shrink-0 text-danger-text disabled:opacity-50`}
            >
              <CloseIcon size={18} />
            </button>
            <Button size="sm" className="flex-1" loading={applying} disabled={applying || locked} onClick={onApply}>
              Postularme
            </Button>
          </div>
        </div>
      </div>
    </Comanda>
  );
}

