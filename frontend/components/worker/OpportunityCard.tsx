"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Avatar } from "@/components/ui";
import {
  CalendarIcon,
  ChevronDownIcon,
  CloseIcon,
  FlameIcon,
  MapPinIcon,
  RouteIcon,
  UsersIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import { cldThumb } from "@/lib/cloudinary";
import { Button } from "@/components/ui";
import SaveShiftButton from "@/components/worker/SaveShiftButton";

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
  heroFallbackClassName = "bg-gradient-to-br from-primary to-primary-strong",
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
  /** Clase de fondo del hero cuando no hay foto — por defecto el gradiente
   *  de marca (un solo acento, Ley de marca; ver comentario abajo). SÓLO la
   *  usa `ScrollHeroShowcase` (landing) para dar un color distinto a cada
   *  una de sus 3 tarjetas de ejemplo: ahí las 3 conviven a la vista al
   *  mismo tiempo como "product shot", así que un solo naranja repetido se
   *  ve monótono/roto (Julieta, captura 2026-08-16: "modificaste el color
   *  de las tarjetas que se mueven a un solo naranja, antes eran de
   *  colores"). En el feed real las tarjetas nunca conviven dos a la vista
   *  (un turno por vez, swipe), así que ahí el default de un solo acento
   *  sigue siendo lo correcto — este prop no cambia ese comportamiento. */
  heroFallbackClassName?: string;
}) {
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const [broken, setBroken] = useState(false);
  const hasPhoto = Boolean(shift.company_logo_url) && !broken;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-float)] ring-1 ring-line">
      {/* Hero: antes competía 50/50 por el alto con el cuerpo (ambos flex-1) —
          en pantallas más bajas o con dress code largo, el cuerpo perdía esa
          pulseada y su cola (el botón de compartir) quedaba recortada en
          silencio por el `overflow-hidden` del padre, sin scroll ni aviso
          (bug real reportado por Julieta con captura, 2026-07-29). El hero
          tiene una altura fija (`shrink-0`, no negocia) y el cuerpo se lleva
          TODO el resto — con su propio scroll de respaldo (ver abajo) para
          cualquier combinación de contenido/pantalla que igual no entre.
          42%→36% (Julieta, 2026-08-16, con "Cómo llegar" pidiendo entrar sin
          deslizar): con el body real medido (pago, fecha/cantidad/dress
          code, "Cómo llegar") el hero al 42% dejaba el cuerpo just al límite
          en viewports comunes — cualquier dress code que ocupara una línea
          de más ya lo hacía scrollear. 36% le devuelve ~30px reales al
          cuerpo sin que la foto deje de ser lo primero que se ve. */}
      <div className="relative h-[36%] min-h-[150px] shrink-0">
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
          // Antes: tinte pálido de SKILL_ACCENT (bg-orange-50, etc.) a toda la
          // tarjeta — esos tokens están pensados sólo para el chip chico del
          // ícono (ver comentario en skill-style.tsx: "nunca como banda de
          // color a toda la tarjeta"), y el resultado se veía plano/beige
          // (Julieta, captura 2026-08-16). Mismo tratamiento que ya usa el
          // hero sin foto del perfil de trabajador (/workers/[id]): gradiente
          // saturado de marca + gráfico grande centrado, un solo acento por
          // pantalla en vez del tinte de rubro extendido a toda la tarjeta.
          <div className={`absolute inset-0 flex items-center justify-center ${heroFallbackClassName}`}>
            <Icon size={120} className="text-white/90" />
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
          <div className="flex shrink-0 items-center gap-2">
            {shift.urgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-danger-text shadow-sm backdrop-blur">
                <FlameIcon size={13} /> Urgente
              </span>
            )}
            <SaveShiftButton shiftId={shift.id} />
          </div>
        </div>

        {/* Bottom: puesto + ubicación. `line-clamp-2` tope al título (algunos
            rubros, "Personal de eventos"/"Ayudante de cocina", ya ocupan 2
            líneas en columnas angostas) para que nunca crezca más de lo que
            el hero tiene reservado. */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          {/* Blanco siempre, con o sin foto: el fallback ahora es un gradiente
              saturado (no la banda pálida de antes), así que necesita el
              mismo contraste que la foto+velo. */}
          <h2 className="line-clamp-2 text-3xl font-extrabold leading-tight text-white drop-shadow">
            {SKILL_LABELS[shift.position]}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-white/90">
            <MapPinIcon size={15} />
            {shift.city ?? "Ubicación a confirmar"}
            {distanceKm != null && <span className="text-white/70">· {formatDistance(distanceKm)}</span>}
          </p>
        </div>
      </div>

      {/* Cuerpo: ya no compite con el hero por el alto (el hero ahora es fijo,
          arriba). `overflow-y-auto` sólo por debajo de `md` — en mobile el
          mazo mide su alto contra el viewport real y con dress code largo
          algunos dispositivos igual se quedan cortos (bug real confirmado con
          captura, Julieta 2026-07-29): esto scrollea en vez de recortar en
          silencio. "Compartir por WhatsApp" (que ocupaba espacio acá abajo)
          se sacó el 2026-08-16 — duplicaba `ShareShiftButton`, que ya vive en
          /turno/[id], y tapaba "Cómo llegar" en pantallas más bajas (pedido
          de Julieta: "no sé si aporta algo, sacando eso entra bien cómo
          llegar sin quedar oculto"). En `md+` se saca (`md:overflow-visible`) — ahí
          la tarjeta ya tiene un alto fijo generoso (grilla de escritorio) y un
          overflow-y-auto anidado atrapaba la rueda del mouse (confirmado
          antes: rompía el scroll de toda la grilla).
          `touch-pan-y`: sin esto, arrancar el arrastre DENTRO de este
          scroll (en vez de sobre la foto del hero) hacía que el navegador se
          quedara con el gesto para sí (scroll vertical) y nunca lo dejara
          llegar al `drag="x"` de SwipeDeck — el swipe para aceptar/rechazar
          sólo funcionaba arrancando justo sobre la parte ilustrada (bug real,
          Julieta 2026-07-31). Con `touch-pan-y` el navegador sólo reclama el
          gesto si es vertical y deja pasar el horizontal. */}
      <div className="flex flex-1 flex-col justify-between gap-2.5 overflow-y-auto p-5 pt-3 touch-pan-y md:overflow-visible">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Pago</p>
            <p className="flex items-baseline gap-1 font-extrabold text-primary-text">
              <span className="text-lg">{shift.currency}</span>
              {/* 39px: paso de la escala modular 1.25 (ART_DIRECTION §9.4),
                  antes 36px (2.25rem) sin relación con la escala. */}
              <span className="text-[2.4375rem] leading-none tracking-tight">
                {Number(shift.pay_amount).toLocaleString("es-AR")}
              </span>
            </p>
            {shift.tips && <p className="text-xs font-medium text-ink/40">+ propinas</p>}
            {shift.meal && <p className="text-xs font-medium text-ink/40">+ comida</p>}
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
        </div>
      </div>

      {/* Pista de que hay más para ver deslizando el dedo adentro de la
          tarjeta (no era obvio, Julieta 2026-07-31) — sólo mobile, donde el
          cuerpo puede scrollear; en `md+` la tarjeta ya tiene alto fijo de
          sobra y nunca hace falta. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 pt-4 md:hidden">
        <ChevronDownIcon size={16} className="text-ink/30" />
      </div>
    </div>
  );
}
