"use client";

import { useEffect, useRef } from "react";
import { useInView } from "motion/react";
import Badge from "@/components/ui/Badge";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { ShieldIcon } from "@/components/icons";
import { setReloj } from "./relojStore";
import { useStory } from "./Stage";

/**
 * CONFIANZA. El segundo silencio: nada se mueve. En vez de tarjetas con
 * íconos, una ficha técnica (etiqueta, dato, línea fina) con lo que responde
 * el miedo que le queda a cada lado: quién entra a mi salón, y quién me paga
 * y adónde voy. Cada fila es una regla real del producto, no una promesa:
 * - identidad y verificación del comercio: ADR-0010 y ADR-0013;
 * - no se presentó: ADR-0007; pasa a urgente a los 8 minutos: ADR-0009
 *   (ESCALATION_DELAY en backend/app/modules/shift/application/services.py);
 * - ubicación: ADR-0014 y "va en camino" (#320); postulaciones que se pisan:
 *   `_withdraw_overlapping_applications` al confirmar.
 * Los dos sellos son los mismos componentes que ya se vieron en la historia.
 */
const LOCAL = [
  { k: "Identidad", v: "El trabajador sube su DNI y una selfie, y los revisa una persona.", badge: "identidad" },
  { k: "Reputación", v: "Puntualidad y reseñas de turnos hechos en Oído. Nadie se las pone solo." },
  { k: "Si no viene", v: "Marcás que no se presentó, el turno se reabre y elegís a otra persona sin volver a publicar." },
  { k: "Si nadie lo toma", v: "A los 8 minutos pasa a urgente y se lo avisamos a más gente." },
] as const;

const TRABAJO = [
  { k: "El local", v: "Los comercios pueden verificarse con su constancia de AFIP, que también revisa una persona.", badge: "comercio" },
  { k: "Tu plata", v: "El comercio te paga directo, sin comisión ni intermediarios." },
  { k: "Tu ubicación", v: "Sólo cuando la prendés vos, y nunca el recorrido." },
  { k: "Tus turnos", v: "Confirmás uno y se bajan solas tus postulaciones que se pisan con ese horario." },
] as const;

export default function Confianza() {
  const ref = useRef<HTMLElement>(null);
  const { enhanced } = useStory();
  // La historia terminó: de acá para abajo no hay reloj.
  const inView = useInView(ref, { margin: "0px 0px -85% 0px" });
  useEffect(() => {
    if (enhanced && inView) setReloj(null);
  }, [enhanced, inView]);

  return (
    <section
      ref={ref}
      aria-label="Confianza"
      data-tone="paper"
      className="bg-paper px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28"
    >
      <h2 className="font-display text-poster font-semibold tracking-[-0.03em] text-ink [text-wrap:balance] lg:col-span-4 lg:text-[length:var(--text-poster)]">
        Sabés quién viene. <span className="font-medium text-ink-soft">Y ella sabe a dónde va.</span>
      </h2>
      <div className="mt-12 grid gap-12 lg:col-span-7 lg:col-start-6 lg:mt-0 lg:grid-cols-2 lg:gap-10">
        <Ficha titulo="Si tenés un local" filas={LOCAL} />
        <Ficha titulo="Si trabajás" filas={TRABAJO} />
      </div>
    </section>
  );
}

function Ficha({
  titulo,
  filas,
}: {
  titulo: string;
  filas: readonly { k: string; v: string; badge?: "identidad" | "comercio" }[];
}) {
  return (
    <div>
      <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-primary-text">{titulo}</p>
      <dl className="mt-4 border-t border-line">
        {filas.map((f) => (
          <div key={f.k} className="border-b border-line py-4">
            <dt className="font-mono text-label font-medium uppercase tracking-[0.12em] text-ink-mute">{f.k}</dt>
            <dd className="mt-1.5 text-body text-ink lg:text-base">
              {f.v}
              {f.badge === "identidad" && (
                <span className="mt-2 block">
                  <IdentityVerifiedBadge verified />
                </span>
              )}
              {f.badge === "comercio" && (
                <span className="mt-2 block">
                  <Badge tone="trust" icon={<ShieldIcon size={11} />}>
                    Comercio verificado
                  </Badge>
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
