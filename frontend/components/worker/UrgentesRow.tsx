"use client";

import { memo } from "react";
import Link from "next/link";
import { SKILL_LABELS, type Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatPayAmount, formatPayCompact } from "@/lib/pay";
import { formatDistance } from "@/lib/format";
import { FlameIcon } from "@/components/icons";
import { useAhora } from "@/lib/use-ahora";
import { empiezaEn, urgentesDe } from "@/lib/urgentes";

/** Cada cuánto se refresca la cuenta regresiva: un minuto, para toda la fila. */
const CADA_MS = 60_000;

/**
 * «Urgentes» del Inicio de quien trabaja: arriba de la hoja, una fila
 * horizontal (con `scroll-snap`) de tarjetas compactas con los turnos que
 * empiezan en las próximas 6 horas, el que empieza antes primero, hasta 8.
 * Cada una lleva la cuenta regresiva («Empieza en 1 h 40») en el rojo de
 * «Urgente» que ya existe (nunca en ámbar), el pago en grande, el rubro, el
 * puesto, el local y la distancia, y abre `/turno/[id]`.
 *
 * - La fuente son los turnos que el Inicio ya muestra (`shifts`): el mismo
 *   corte de radio y sin los que la persona ya se postuló. Acá «urgente» es
 *   la cercanía del horario (`lib/urgentes.ts`), no la marca `urgent` del
 *   comercio.
 * - Un solo temporizador para toda la fila (`useAhora`, cada minuto, que se
 *   limpia al desmontar y se pausa con la pestaña oculta). Cuando un turno
 *   empieza, sale de la fila solo; sin ninguno, no se dibuja nada.
 * - Accesibilidad: una región con nombre («Urgentes»), una lista que se
 *   recorre con Tab, y cada tarjeta es un enlace con el nombre completo. No
 *   hay `aria-live`: el cambio de minuto no se anuncia.
 */
function UrgentesRow({
  shifts,
  distanceOf,
}: {
  shifts: Shift[];
  distanceOf: (s: Shift) => number | null;
}) {
  const ahora = useAhora(shifts.length > 0, CADA_MS);
  const urgentes = urgentesDe(shifts, ahora);
  if (urgentes.length === 0) return null;

  return (
    <section data-testid="feed-urgentes" aria-labelledby="urgentes-titulo" className="urgentes">
      <h2 id="urgentes-titulo" className="flex items-center gap-1.5 text-h3 font-bold text-ink">
        <FlameIcon size={18} className="text-danger-text" aria-hidden /> Urgentes
      </h2>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari/VoiceOver pierde la lista con `list-style: none`; el rol la mantiene */}
      <ul role="list" className="urgentes-carril no-scrollbar">
        {urgentes.map(({ shift: s, faltaMs }) => {
          const { Icon } = SKILL_ACCENT[s.position];
          const km = distanceOf(s);
          const distancia = km != null ? formatDistance(km) : null;
          const cuenta = empiezaEn(faltaMs);
          const nombre = [
            "Urgente",
            SKILL_LABELS[s.position],
            s.company_name ?? "Comercio",
            cuenta.toLowerCase(),
            formatPayAmount(s),
            distancia ? `a ${distancia}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={s.id} className="urgente-item">
              <Link
                href={`/turno/${s.id}`}
                data-testid="feed-urgente-card"
                aria-label={nombre}
                className="tecla urgente-tarjeta"
              >
                <span className="chip-urgencia" data-testid="feed-urgente-cuenta">
                  <FlameIcon size={12} aria-hidden /> {cuenta}
                </span>
                <span className="urgente-pago">{formatPayCompact(s)}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cielo-tint text-cielo-text">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-fila font-bold leading-tight text-ink">
                      {SKILL_LABELS[s.position]}
                    </span>
                    <span className="block truncate text-caption text-ink-soft">
                      {s.company_name ?? "Comercio"}
                      {distancia && ` · ${distancia}`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default memo(UrgentesRow);
