import { SKILL_LABELS, type WorkerSkill } from "@/lib/types";
import { formatDuration, formatShiftDayLong, formatShiftTime } from "@/lib/datetime";
import { formatArs } from "@/lib/format";
import { CalendarIcon, ClockIcon, FlameIcon, MapPinIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * El turno que se está por publicar, como lo van a ver (dirección suave,
 * ADR-0028; Julieta, 2026-11-19). Arriba, el cielo con el puesto y los datos
 * en chips (el día, el horario, dónde); abajo, el pago bien grande y los
 * extras. Lo usan el último paso de «Publicar turno» y, en la compu, la vista
 * previa del costado, que se va llenando paso a paso: lo que falta dice
 * «Todavía sin definir».
 */
export default function PedidoTarjeta({
  position,
  startIso,
  endIso,
  durationMinutes,
  place,
  quantity,
  payAmount,
  tips,
  meal,
  dressCode,
  urgent,
  apunte,
  className,
  "aria-label": ariaLabel = "El turno",
}: {
  position: WorkerSkill | null;
  startIso: string | null;
  endIso: string | null;
  durationMinutes: number | null;
  place: string | null;
  quantity: number;
  payAmount: number | null;
  tips: boolean;
  meal: boolean;
  dressCode: string;
  urgent: boolean;
  /** El apunte a mano de arriba («Así lo van a ver»). */
  apunte?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const extras = [
    quantity > 1 ? `${quantity} personas` : null,
    tips ? "+ propinas" : null,
    meal ? "Comida" : null,
    dressCode ? `Dress code: ${dressCode}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <section aria-label={ariaLabel} className={cn("pedido-tarjeta", className)}>
      <div className="app-cielo px-5 pb-5 pt-4">
        {apunte && <p className="letra-mano text-lg">{apunte}</p>}
        <div className={cn("flex items-start justify-between gap-3", apunte && "mt-1")}>
          <h2 className="min-w-0 break-words text-h1 font-extrabold leading-tight tracking-tight">
            {position ? SKILL_LABELS[position] : <span className="opacity-60">¿Qué puesto?</span>}
          </h2>
          {urgent && (
            // El color va en línea: `.chip-vidrio` pone la tinta del cielo y le
            // gana a una utilidad.
            <span className="chip-vidrio mt-1 shrink-0" style={{ color: "var(--color-danger-text)" }}>
              <FlameIcon size={14} /> Urgente
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {startIso && endIso ? (
            <>
              <span className="chip-vidrio">
                <CalendarIcon size={14} />
                <span className="first-letter:uppercase">{formatShiftDayLong(startIso)}</span>
              </span>
              <span className="chip-vidrio">
                <ClockIcon size={14} />
                {formatShiftTime(startIso)} → {formatShiftTime(endIso)}
                {durationMinutes != null && ` · ${formatDuration(durationMinutes)}`}
              </span>
            </>
          ) : (
            <span className="chip-vidrio opacity-70">
              <CalendarIcon size={14} /> Cuándo: todavía sin definir
            </span>
          )}
          <span className={cn("chip-vidrio", !place && "opacity-70")}>
            <MapPinIcon size={14} />
            {place ?? "Dónde: todavía sin definir"}
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">
        <p className="text-sm font-semibold text-ink-soft">
          {quantity === 1 ? "Pago por la jornada" : "Pago por persona, por la jornada"}
        </p>
        {payAmount != null && payAmount > 0 ? (
          <p className="mt-1 text-price font-extrabold leading-none tracking-tight text-ink">
            {formatArs(payAmount)}
          </p>
        ) : (
          <p className="mt-1 text-lg font-semibold text-ink-soft">Todavía sin definir</p>
        )}
        {extras.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {extras.map((x) => (
              <span key={x} className="chip-suave">
                {x}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
