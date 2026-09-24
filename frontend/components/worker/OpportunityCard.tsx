"use client";

import Link from "next/link";
import { useState } from "react";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT, SKILL_HERO_TONE } from "@/lib/skill-style";
import { formatPayAmount, payPerHour } from "@/lib/pay";
import { Avatar } from "@/components/ui";
import { ClockIcon, CloseIcon, FlameIcon, MapPinIcon, RouteIcon } from "@/components/icons";
import { formatDuration, formatShiftWhen, shiftDurationMinutes } from "@/lib/datetime";
import { cldThumb } from "@/lib/cloudinary";
import { Button } from "@/components/ui";
import SaveShiftButton from "@/components/worker/SaveShiftButton";
import { shiftHeroPhoto } from "@/lib/company-photo";

/**
 * Tarjeta grande de oportunidad (DS v2, foto-first): foto real
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
  const { Icon } = SKILL_ACCENT[shift.position];
  const heroFallback = SKILL_HERO_TONE[shift.position];
  const [broken, setBroken] = useState(false);
  const heroPhoto = shiftHeroPhoto(shift);
  const hasPhoto = Boolean(heroPhoto) && !broken;
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  const perHour = payPerHour(shift);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-float)] ring-1 ring-line">
      {/* Hero: antes competía 50/50 por el alto con el cuerpo (ambos flex-1) —
          en pantallas más bajas o con dress code largo, el cuerpo perdía esa
          pulseada y su cola (el botón de compartir) quedaba recortada en
          silencio por el `overflow-hidden` del padre, sin scroll ni aviso
          (bug real reportado por Julieta con captura, 2026-07-29). El hero
          tiene una altura fija (`shrink-0`, no negocia) y el cuerpo se lleva
          TODO el resto — con su propio scroll de respaldo (ver abajo) para
          cualquier combinación de contenido/pantalla que igual no entre.
          42%→36%→31% (Julieta, 2026-08-16 y 2026-08-17, pidiendo dos veces
          que "Cómo llegar" entre sin deslizar): con el body real medido
          (pago, fecha/cantidad/dress code, "Cómo llegar") el hero al 42%
          dejaba el cuerpo al límite en viewports comunes — cualquier dress
          code de una línea más ya lo hacía scrollear.

          FIX ESTRUCTURAL (Julieta, 2026-08-17: "el título Mozo y Palermo
          está muy junto de Mi comercio, bajalo para que no se superponga").
          Era una regresión que introduje yo al bajar el hero a 31%: sus dos
          bloques (pastilla del comercio arriba, título+ubicación abajo)
          estaban `absolute` contra un alto FIJO, así que al achicar el alto
          por debajo de lo que mide el contenido, los bloques se pisan — el
          alto no reacciona al contenido. Ahora el hero es un flex column con
          los dos bloques EN FLUJO (`justify-between`): el `min-h` cubre lo
          que miden de verdad (~54px la fila de arriba + ~82px el título y la
          ubicación + aire), así que superponerse es imposible por
          construcción, no por haber elegido bien un número. Sólo el fondo
          (foto/gradiente/velo) sigue absolute, que es lo que corresponde. */}
      {/* 31% → 42% (DS v5.0): el cuerpo se achicó (sin el chip del rubro ni
          la fila "1 persona") y a 31% quedaba un hueco blanco de ~300px entre
          el horario y "Cómo llegar". El `min-h` y el flex en flujo de abajo
          siguen evitando que los bloques del banner se pisen. */}
      <div className="relative flex h-[42%] min-h-[148px] shrink-0 flex-col justify-between overflow-hidden">
        {hasPhoto ? (
          <img
            src={cldThumb(heroPhoto, 800)}
            alt={shift.company_name ?? "Local"}
            onError={() => setBroken(true)}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Banner sin foto, en tres iteraciones (Julieta, 2026-08-16):
          // arrancó con el tinte pálido de SKILL_ACCENT a toda la tarjeta
          // ("muy beige, plano" — y además contra el propio comentario de
          // skill-style.tsx: "nunca como banda de color a toda la tarjeta");
          // pasó a un único gradiente naranja de marca (mejor, pero todas
          // las tarjetas iguales); después a un gradiente saturado por
          // rubro; desde el DS v5.0 es un tono profundo y plano por rubro
          // (SKILL_HERO_TONE): dos turnos seguidos siguen distinguiéndose,
          // sin que el banner compita con el ámbar.
          <div className={`absolute inset-0 overflow-hidden ${heroFallback}`}>
            {/* Marca de agua en la ESQUINA y al 15%, igual que `ShiftCard`
                (auditoría de iconografía, 2026-09-10). Antes iba centrado a
                120px y al 90% de blanco: eso no es una marca de agua, es un
                elemento que compite — y como el título del turno se apoya
                abajo del hero, el ícono le caía justo encima. Medido en un
                render a 390×844: el glifo se cruzaba con "Mozo/a" y el título
                quedaba ilegible. Es el mismo defecto que la inicial y la
                cámara pisándose en el avatar (fase L): dos cosas dibujadas en
                el mismo lugar porque cada una se posicionó por su cuenta. */}
            <Icon size={132} className="absolute -right-5 -top-6 text-white/15" />
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
        <div className="relative flex items-center justify-between gap-2 p-3.5">
          <Link
            href={`/companies/${shift.company_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-w-0 items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 shadow-sm"
          >
            <Avatar src={shift.company_logo_url} name={shift.company_name ?? "Local"} size="sm" />
            <span className="truncate text-sm font-bold text-ink">{shift.company_name ?? "Local"}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {shift.urgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-bold text-danger-text shadow-sm">
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
        <div className="relative px-5 pb-4">
          {/* Blanco siempre, con o sin foto: el fallback ahora es un gradiente
              saturado (no la banda pálida de antes), así que necesita el
              mismo contraste que la foto+velo. */}
          <h2 className="line-clamp-2 font-display text-h1 font-medium text-white drop-shadow">
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
      {/* Vuelve a `pb-5` parejo: el `pb-10` era el hueco que necesitaba la
          pista de scroll para no taparle "Cómo llegar", y esa pista ya no
          existe (ver abajo). */}
      {/* `justify-start` + `mt-auto` en la acción, NO `justify-between` en todo
          el cuerpo (auditoría de espaciado, 2026-09-10). Con `justify-between`
          el sobrante se abría ENTRE el pago y las fechas: medido a 390×844,
          ~250px de blanco muerto en el medio de la tarjeta, con el pago
          arriba de todo y la fecha pegada al botón. El aire tiene que estar
          antes de la acción —ahí se lee como respiro— y no partiendo al medio
          el contenido, que es lo que lo hace ver como un error de layout. */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-5 pt-3 touch-pan-y md:overflow-visible">
        {/* Pago y horario (DS v5.0): el monto en el mismo formato que el
            home y el detalle ("$38.000"), con el pago por hora al lado —
            los turnos duran distinto, y el total solo engaña (ADR-0012) —; y
            el horario en 24 h ("Hoy · 20:00 – 02:00"), no "08:00 p. m.".
            Sin el chip del ícono del rubro que iba a la derecha: repetía el
            ícono del banner y en oscuro quedaba como un cuadro pálido. Sin la
            fila "1 persona": un turno es siempre una persona (ADR-0003). */}
        <div>
          <p className="text-label font-bold uppercase tracking-wide text-ink/40">Pago</p>
          <p className="text-price font-extrabold tracking-tight text-primary-text">{formatPayAmount(shift)}</p>
          {perHour && (
            <p className="text-xs font-medium text-ink/50">
              ≈ {formatPayAmount({ pay_amount: String(Math.round(perHour)), currency: shift.currency })} por hora
            </p>
          )}
        </div>

        <div className="space-y-1.5 text-body text-ink/80">
          <p className="flex items-center gap-2">
            <ClockIcon size={18} className="shrink-0 text-ink/35" />
            <span>
              {formatShiftWhen(shift.start_at, shift.end_at)}
              {minutes != null && <span className="text-ink/45"> · {formatDuration(minutes)}</span>}
            </span>
          </p>
        </div>

        {/* Qué incluye: los mismos chips que el detalle del turno. */}
        {(shift.tips || shift.meal || shift.dress_code) && (
          <div className="flex flex-wrap gap-1.5">
            {shift.tips && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink/70">Propinas</span>}
            {shift.meal && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink/70">Comida del personal</span>}
            {shift.dress_code && (
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink/70">
                Vestimenta: {shift.dress_code}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto space-y-3 pt-2">
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
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-card py-2.5 text-sm font-semibold text-ink/80 active:scale-[0.98]"
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-danger-text disabled:opacity-50"
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

      {/* Acá vivía la pista de scroll (degradé blanco + chevron), agregada el
          2026-07-31 cuando el cuerpo era más largo y no era obvio que hubiera
          más abajo. Se saca (Julieta, 2026-08-17: "saca el botón de deslizar,
          todo tiene que entrar bien"): con el WhatsApp ya fuera de la tarjeta
          y el hero más chico, el contenido entra completo, así que la pista
          anunciaba un scroll que ya no existe — y encima el degradé se
          dibujaba ENCIMA de "Cómo llegar" y lo hacía ver apagado, que fue el
          síntoma reportado. El `overflow-y-auto` del cuerpo se mantiene como
          red de seguridad para combinaciones raras (dress code muy largo en
          una pantalla muy baja): si alguna vez hace falta scrollear, se puede
          igual, sólo que ya no se anuncia. */}
    </div>
  );
}
