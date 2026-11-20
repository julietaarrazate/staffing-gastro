"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatPayCompact } from "@/lib/pay";
import { formatDuration, formatShiftWhenLive, shiftDurationMinutes } from "@/lib/datetime";
import { cldThumb } from "@/lib/cloudinary";
import { shiftHeroPhoto } from "@/lib/company-photo";
import { formatDistance } from "@/lib/format";
import { shareShift } from "@/lib/shift-share";
import { Button, PortadaCielo } from "@/components/ui";
import { CloseIcon, RouteIcon, ShareIcon, ShieldIcon } from "@/components/icons";
import SaveShiftButton from "@/components/worker/SaveShiftButton";

/** Un botón redondo y quieto de la fila (44 px): relleno del campo, sin borde. */
const BOTON_REDONDO =
  "pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--suave-campo)] transition active:scale-90 disabled:opacity-50";

/**
 * Un turno de Buscar como fila suave (dirección suave, ADR-0028, 2026-11-20):
 * una tecla blanca con la foto del local (sin foto, el cielo de
 * `PortadaCielo`), el puesto, el pago en grande a la derecha, el local con la
 * distancia y, en el último renglón, cuándo y la marca «Urgente» al final.
 * Abajo, las acciones de siempre: guardar, «Cómo llegar», «Compartir», «No,
 * gracias» y «Postularme». La fila entera lleva al detalle (`/turno/[id]`) con
 * un link real; los botones no navegan. Del 2026-11-19 al 20 fue una comanda
 * de papel (`OportunidadComanda`).
 *
 * `destacado`: «Postularme» en ámbar. Lo lleva sólo el primero de la lista
 * (un solo ámbar por pantalla); en los demás va quieto.
 */
export default function OportunidadFila({
  shift,
  distanceKm,
  onApply,
  onPass,
  applying = false,
  locked = false,
  destacado = false,
}: {
  shift: Shift;
  distanceKm: number | null;
  onApply: () => void;
  onPass: () => void;
  applying?: boolean;
  locked?: boolean;
  destacado?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const { Icon } = SKILL_ACCENT[shift.position];
  const label = SKILL_LABELS[shift.position];
  const where = [shift.company_name, shift.city].filter(Boolean).join(" · ");
  const distancia = distanceKm != null ? formatDistance(distanceKm) : null;
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const hasDirections = shift.latitude != null && shift.longitude != null;

  return (
    <article data-testid="buscar-card" className="tecla fila-buscar relative h-full">
      <Link
        href={`/turno/${shift.id}`}
        data-testid="opportunity-card-link"
        aria-label={`Ver el turno de ${label}${shift.company_name ? ` en ${shift.company_name}` : ""}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
      />
      <div className="pointer-events-none relative z-[2] flex h-full flex-col p-3">
        {/* Con la letra muy grande el texto baja debajo de la foto y usa todo el ancho. */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span className="fila-buscar-foto relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-surface">
            {hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- la optimización la hace Cloudinary (cldThumb)
              <img
                src={cldThumb(heroPhoto, 200)}
                alt=""
                width={72}
                height={72}
                onError={() => setBroken(true)}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <PortadaCielo id={shift.id} Icon={Icon} mini />
            )}
          </span>
          <div className="min-w-0 flex-1 basis-[9rem]">
            {/* El puesto no se parte: si no entra al lado del pago, el pago
                baja de renglón (a 320 px); y con la letra al 200 % deja de
                crecer en 7,5vw, que es lo que entra «Recepcionista» a 320 px. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <h2 className="min-w-0 break-words text-[length:min(1rem,7.5vw)] font-extrabold leading-tight tracking-[-0.01em] text-ink">
                {label}
              </h2>
              <p data-testid="buscar-pago" className="fila-buscar-pago ml-auto text-ink">
                {formatPayCompact(shift)}
              </p>
            </div>
            {(where || distancia || shift.company_verified || shift.tips) && (
              <div className="mt-0.5 flex flex-wrap items-start justify-between gap-x-2 text-caption leading-snug text-ink-soft">
                {/* `break-words`: un nombre de comercio sin espacios no ensancha la página. */}
                <p className="min-w-0 flex-1 basis-[7rem] break-words">
                  {shift.company_verified && (
                    <span
                      role="img"
                      aria-label="Comercio verificado"
                      title="Comercio verificado"
                      className="mr-1 inline-flex translate-y-[2px] text-cielo-text"
                    >
                      <ShieldIcon size={13} />
                    </span>
                  )}
                  {where}
                  {/* La distancia no se parte («1,1» en un renglón y «km» en otro). */}
                  {distancia && (
                    <span className="whitespace-nowrap">
                      {where ? " · " : ""}
                      {distancia}
                    </span>
                  )}
                </p>
                {shift.tips && <p className="ml-auto shrink-0 whitespace-nowrap">+ propinas</p>}
              </div>
            )}
            {/* Cuándo, y la marca al final del renglón. */}
            <div className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="min-w-0 text-caption font-semibold text-ink">
                {formatShiftWhenLive(shift)}
                {minutes != null && (
                  <>
                    {" "}
                    <span className="whitespace-nowrap font-medium text-ink-soft">· {formatDuration(minutes)}</span>
                  </>
                )}
              </p>
              {shift.urgent && <span className="chip-suave chip-urgente fila-buscar-marca ml-auto">Urgente</span>}
            </div>
          </div>
        </div>

        {/* Sólo los botones reciben el toque: el aire entre ellos sigue
            abriendo el detalle, como el resto de la fila. */}
        {/* Con lugar, todo en un renglón; sin lugar (320 px o letra
            grande), «No, gracias» y «Postularme» bajan juntos. */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <SaveShiftButton shiftId={shift.id} className="pointer-events-auto !h-11 !w-11 !bg-[var(--suave-campo)] !shadow-none" />
          {hasDirections && (
            <button
              type="button"
              aria-label="Cómo llegar"
              title="Cómo llegar"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className={`${BOTON_REDONDO} text-primary-text`}
            >
              <RouteIcon size={18} />
            </button>
          )}
          <button
            type="button"
            aria-label="Compartir"
            title="Compartir"
            onClick={() => shareShift(shift, `${window.location.origin}/turno/${shift.id}`)}
            className={`${BOTON_REDONDO} text-primary-text`}
          >
            <ShareIcon size={18} />
          </button>
          <div className="ml-auto flex min-w-0 flex-1 basis-[min(10.5rem,100%)] gap-2">
            <button
              type="button"
              aria-label="No, gracias"
              title="No, gracias"
              onClick={onPass}
              disabled={applying || locked}
              className={`${BOTON_REDONDO} text-danger-text`}
            >
              <CloseIcon size={18} />
            </button>
            <Button
              size="sm"
              variant={destacado ? "primary" : "surface"}
              className={`pointer-events-auto min-h-[44px] min-w-0 flex-1 ${destacado ? "" : "boton-quieto"}`}
              loading={applying}
              disabled={applying || locked}
              onClick={onApply}
            >
              Postularme
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
