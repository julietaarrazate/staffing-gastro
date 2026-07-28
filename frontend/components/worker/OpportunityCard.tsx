"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Avatar } from "@/components/ui";
import {
  CalendarIcon,
  FlameIcon,
  MapPinIcon,
  ShareIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import { shareShift } from "@/lib/shift-share";
import { cldThumb } from "@/lib/cloudinary";

/**
 * Tarjeta grande de oportunidad (DS v2, foto-first estilo Airbnb): foto real
 * del local como hero, cuerpo blanco con los datos y un chip de ícono con
 * acento sobrio por rubro. Si no hay foto, hero limpio con el tinte del rubro.
 */
/** Distancia legible: bajo 1 km en metros redondeados, arriba con un decimal. */
function formatDistance(km: number): string {
  return km < 1 ? `a ${Math.round(km * 1000)} m` : `a ${km.toFixed(1)} km`;
}

export default function OpportunityCard({
  shift,
  distanceKm,
}: {
  shift: Shift;
  /** Distancia desde donde está parado el trabajador (ver current-location). */
  distanceKm?: number | null;
}) {
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const [broken, setBroken] = useState(false);
  const hasPhoto = Boolean(shift.company_logo_url) && !broken;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-float)] ring-1 ring-line">
      {/* Hero: `flex-[1.15]` reparte el alto disponible con el cuerpo, pero
          sin piso propio colapsa a 0 en contenedores bajos (el padre flex no
          tiene de dónde repartir) — la foto/ícono y el texto superpuesto
          desaparecen. `min-h-[200px]` (deuda de #79) asegura un hero visible
          incluso cuando el contenedor del swipe deck es más bajo de lo
          esperado. */}
      <div className="relative min-h-[170px] flex-1">
        {hasPhoto ? (
          <img
            src={cldThumb(shift.company_logo_url, 800)}
            alt={shift.company_name ?? "Local"}
            onError={() => setBroken(true)}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 ${bg}`}>
            <Icon size={140} className={`absolute -right-4 -top-2 ${fg} opacity-25`} />
          </div>
        )}
        {/* Velo para legibilidad del texto sobre la foto */}
        {hasPhoto && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
        )}

        {/* Top: comercio + urgente */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3.5">
          <Link
            href={`/companies/${shift.company_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-sm backdrop-blur"
          >
            <Avatar src={shift.company_logo_url} name={shift.company_name ?? "Local"} size="sm" />
            <span className="text-sm font-bold text-ink">{shift.company_name ?? "Local"}</span>
          </Link>
          {shift.urgent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-danger shadow-sm backdrop-blur">
              <FlameIcon size={13} /> Urgente
            </span>
          )}
        </div>

        {/* Bottom: puesto + ubicación */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className={`text-3xl font-extrabold leading-tight ${hasPhoto ? "text-white drop-shadow" : "text-ink"}`}>
            {SKILL_LABELS[shift.position]}
          </h2>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${hasPhoto ? "text-white/90" : "text-ink/60"}`}>
            <MapPinIcon size={15} />
            {shift.city ?? "Ubicación a confirmar"}
            {distanceKm != null && (
              <span className={hasPhoto ? "text-white/70" : "text-ink/45"}>
                · {formatDistance(distanceKm)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Pago</p>
            <p className="flex items-baseline gap-1 font-extrabold text-primary">
              <span className="text-lg">{shift.currency}</span>
              <span className="text-[2.25rem] leading-none tracking-tight">
                {Number(shift.pay_amount).toLocaleString("es-AR")}
              </span>
            </p>
            {shift.tips && <p className="text-xs font-medium text-ink/40">+ propinas</p>}
          </div>
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bg} ${fg}`}>
            <Icon size={24} />
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 text-[15px] text-ink/80">
            <p className="inline-flex items-center gap-2">
              <CalendarIcon size={18} className="text-ink/35" />
              {formatShiftRange(shift.start_at, shift.end_at)}
            </p>
            <p className="inline-flex items-center gap-2">
              <UsersIcon size={18} className="text-ink/35" />
              {shift.quantity} {shift.quantity === 1 ? "persona" : "personas"}
            </p>
            {shift.dress_code && <p className="text-sm text-ink/50">Dress code: {shift.dress_code}</p>}
          </div>

          {/* Compartir a un colega que esté buscando trabajo (WhatsApp/share
              sheet → página pública del turno). Botón claro y etiquetado, no un
              ícono suelto. stopPropagation en pointer/click para que el gesto no
              arranque el drag del SwipeDeck ni cuente como swipe. Estilo neutro
              (blanco/ink): el único acento naranja de la tarjeta es el pago. */}
          <button
            type="button"
            aria-label="Compartir turno por WhatsApp"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              shareShift(shift, `${window.location.origin}/turno/${shift.id}`);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface py-2.5 text-sm font-semibold text-ink/80 active:scale-[0.98]"
          >
            <ShareIcon size={16} /> Compartir por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
