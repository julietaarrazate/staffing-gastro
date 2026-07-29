"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Avatar } from "@/components/ui";
import {
  CalendarIcon,
  CloseIcon,
  FlameIcon,
  MapPinIcon,
  RouteIcon,
  ShareIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import { shareShift } from "@/lib/shift-share";
import { cldThumb } from "@/lib/cloudinary";
import { Button } from "@/components/ui";

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
  onApply,
  onPass,
  applying = false,
}: {
  shift: Shift;
  /** Distancia desde donde está parado el trabajador (ver current-location). */
  distanceKm?: number | null;
  /** Grilla de escritorio (feed/page.tsx, md+): decidir sin el gesto de
   *  swipe, que no tiene sentido con mouse. En el mazo mobile (SwipeDeck) y
   *  en la landing (ScrollHeroShowcase) se omiten y la fila no se renderiza. */
  onApply?: () => void;
  onPass?: () => void;
  applying?: boolean;
}) {
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const [broken, setBroken] = useState(false);
  const hasPhoto = Boolean(shift.company_logo_url) && !broken;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-float)] ring-1 ring-line">
      {/* Hero: antes competía 50/50 por el alto con el cuerpo (ambos flex-1) —
          en pantallas más bajas o con dress code largo, el cuerpo perdía esa
          pulseada y su cola (el botón de compartir) quedaba recortada en
          silencio por el `overflow-hidden` del padre, sin scroll ni aviso
          (bug real reportado por Julieta con captura, 2026-07-29). Ahora el
          hero tiene una altura fija (`shrink-0`, no negocia) y el cuerpo se
          lleva TODO el resto — con su propio scroll de respaldo (ver abajo)
          para cualquier combinación de contenido/pantalla que igual no
          entre. */}
      <div className="relative h-[42%] min-h-[168px] shrink-0">
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

        {/* Top: comercio + urgente. `truncate` en el nombre del comercio (antes
            sin tope: un nombre largo envolvía a 2 líneas y se superponía con
            el título de abajo — bug real reportado por Julieta con captura,
            "Catering Puerto Madero" pisando "Personal de eventos", 2026-07-29). */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3.5">
          <Link
            href={`/companies/${shift.company_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-sm backdrop-blur"
          >
            <Avatar src={shift.company_logo_url} name={shift.company_name ?? "Local"} size="sm" />
            <span className="truncate text-sm font-bold text-ink">{shift.company_name ?? "Local"}</span>
          </Link>
          {shift.urgent && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-danger-text shadow-sm backdrop-blur">
              <FlameIcon size={13} /> Urgente
            </span>
          )}
        </div>

        {/* Bottom: puesto + ubicación. `line-clamp-2` tope al título (algunos
            rubros, "Personal de eventos"/"Ayudante de cocina", ya ocupan 2
            líneas en columnas angostas) para que nunca crezca más de lo que
            el hero tiene reservado. */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2
            className={`line-clamp-2 text-3xl font-extrabold leading-tight ${hasPhoto ? "text-white drop-shadow" : "text-ink"}`}
          >
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

      {/* Cuerpo: ya no compite con el hero por el alto (el hero ahora es fijo,
          arriba), así que le queda garantizado ~62% de la tarjeta. Se
          descartó agregar overflow-y-auto acá como red de seguridad extra:
          en la práctica atrapaba la rueda del mouse (cualquier scroll sobre
          una tarjeta de la grilla quedaba "pegado" tratando de scrollear ese
          pedacito interno en vez de la página completa) — un problema peor
          que el que resolvía. */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Pago</p>
            <p className="flex items-baseline gap-1 font-extrabold text-primary-text">
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

          {/* "Cómo llegar" ACÁ, antes de decidir: quien ve la oferta necesita
              saber si le conviene ir ANTES de postularse, no recién cuando ya
              lo asignaron (antes sólo estaba en /my-shifts, con el turno ya
              aceptado — al revés de lo que hace falta; Julieta, 2026-07-29).
              stopPropagation para no interferir con el swipe/drag del mazo. */}
          {shift.latitude != null && shift.longitude != null && (
            <button
              type="button"
              aria-label="Cómo llegar"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-2.5 text-sm font-semibold text-ink/80 active:scale-[0.98]"
            >
              <RouteIcon size={16} /> Cómo llegar
            </button>
          )}

          {/* Decidir sin swipe (grilla de escritorio): mismo par de acciones
              que el mazo mobile, como botones directos. */}
          {(onApply || onPass) && (
            <div className="flex gap-2">
              {onPass && (
                <button
                  type="button"
                  aria-label="No, gracias"
                  onClick={onPass}
                  disabled={applying}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-danger-text disabled:opacity-50"
                >
                  <CloseIcon size={18} />
                </button>
              )}
              {onApply && (
                <Button fullWidth size="sm" loading={applying} disabled={applying} onClick={onApply}>
                  Postularme
                </Button>
              )}
            </div>
          )}

          {/* Compartir a un colega que esté buscando trabajo (WhatsApp/share
              sheet → página pública del turno). Verde (mismo que ya usa
              `ShareShiftButton` en /turno/[id], variant="secondary" = éxito):
              antes este botón puntual quedaba crema/beige, inconsistente con
              el resto de los botones de WhatsApp de la app (Julieta,
              2026-07-29). stopPropagation en pointer/click para que el gesto
              no arranque el drag del SwipeDeck ni cuente como swipe. */}
          <button
            type="button"
            aria-label="Compartir turno por WhatsApp"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              shareShift(shift, `${window.location.origin}/turno/${shift.id}`);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-success py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(34,197,94,0.25)] active:scale-[0.98] hover:brightness-[1.04]"
          >
            <ShareIcon size={16} /> Compartir por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
