import dynamic from "next/dynamic";
import Link from "next/link";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Avatar, Button } from "@/components/ui";
import {
  CalendarIcon,
  CalendarPlusIcon,
  FlameIcon,
  MapPinIcon,
  RouteIcon,
  UsersIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import { downloadShiftIcs } from "@/lib/calendar";
import ShiftLifecycleStepper, { type ShiftStepperPerspective } from "@/components/ShiftLifecycleStepper";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-28 w-full animate-pulse rounded-2xl bg-surface" />,
});

// Ley de marca (docs/PULIDO_ROADMAP.md): un solo acento por pantalla. Naranja
// para todo lo activo/publicado/en curso, verde sólo para éxito (confirmado
// además de los terminales finalizado/pagado), rojo sólo para cancelado, gris
// sólo para borrador. Nada de azul/amber sueltos (bug de la operadora: los
// turnos cancelados/aceptados se veían iguales).
const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-surface text-ink/60",
  publicado: "bg-orange-50 text-primary-text",
  buscando_personal: "bg-orange-50 text-primary-text",
  asignado: "bg-orange-50 text-primary-text",
  confirmado: "bg-green-50 text-success-text",
  en_camino: "bg-orange-50 text-primary-text",
  check_in: "bg-orange-50 text-primary-text",
  trabajando: "bg-orange-50 text-primary-text",
  check_out: "bg-orange-50 text-primary-text",
  finalizado: "bg-green-50 text-success-text",
  pagado: "bg-green-50 text-success-text",
  cancelado: "bg-red-50 text-danger-text",
};

// Estados terminales: la tarjeta entera se atenúa (opacity) para que, en una
// lista mixta, se note de un vistazo qué turno sigue vivo y cuál ya no. El
// color del chip (verde/rojo) sigue siendo la señal principal; la opacidad
// es un refuerzo, no reemplaza el color.
const TERMINAL_STATUSES = new Set(["cancelado", "finalizado", "pagado"]);

export default function ShiftCard({
  shift,
  perspective = "employer",
  children,
}: {
  shift: Shift;
  /** "employer" (default, `/shifts`): Publicado→Asignado→En curso→Finalizado.
   *  "worker" (`/my-shifts`): Postulado→Aceptado→En curso→Finalizado. */
  perspective?: ShiftStepperPerspective;
  children?: React.ReactNode;
}) {
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
  const isTerminal = TERMINAL_STATUSES.has(shift.status);

  return (
    // `.no-select` (bug C0 #2, docs/PULIDO_ROADMAP.md fix 2): esta tarjeta es
    // chrome de UI para tocar/accionar (rubro, chip de estado, fecha,
    // cantidad, dress code), no contenido de lectura genuino — se podía
    // seleccionar como una página web (captura de la operadora). El único
    // texto de lectura real que cuelga de acá (comentario de reseña ya
    // escrito, ver ReviewBox) se reactiva puntualmente con `.select-text`.
    <div
      data-testid="shift-card"
      data-shift-id={shift.id}
      // Antes tenía `overflow-hidden` (sólo para redondear la esquina de arriba
      // del link al comercio). Eso también cortaba cualquier hijo que necesite
      // salirse de la tarjeta — el menú "Más" de ShiftActions, que es un
      // dropdown `position: absolute`, quedaba tapado/recortado en una tira
      // finita en vez de mostrarse completo (bug real con captura, Julieta
      // 2026-07-29). El link de arriba ahora redondea sus propias esquinas.
      className={`no-select rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99] ${
        isTerminal ? "opacity-65 saturate-[0.85]" : ""
      }`}
    >
      {shift.company_name && (
        <Link
          href={`/companies/${shift.company_id}`}
          className="flex items-center gap-2 rounded-t-[var(--radius-card)] border-b border-line px-5 py-2.5 hover:bg-surface"
        >
          <Avatar src={shift.company_logo_url} name={shift.company_name} size="sm" />
          <span className="text-sm font-semibold text-ink/80">{shift.company_name}</span>
        </Link>
      )}

      <div className="px-5 pb-5 pt-4">
        {/* Encabezado: rubro con chip de acento + urgente */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${bg} ${fg}`}>
              <Icon size={24} />
            </span>
            <div>
              <h3 className="text-lg font-extrabold leading-tight text-ink">
                {SKILL_LABELS[shift.position]}
              </h3>
              <p className="inline-flex items-center gap-1 text-sm font-medium text-ink/50">
                <MapPinIcon size={13} />
                {shift.city ?? "Ubicación a confirmar"}
              </p>
            </div>
          </div>
          {shift.urgent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-danger-text">
              <FlameIcon size={13} /> Urgente
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              STATUS_COLORS[shift.status] ?? "bg-surface text-ink/70"
            }`}
          >
            {STATUS_LABELS[shift.status]}
          </span>
          <div className="text-right">
            <p className="text-xl font-extrabold text-primary-text">
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            {shift.tips && <p className="text-xs font-medium text-ink/40">+ propinas</p>}
          </div>
        </div>

        {/* Stepper del ciclo de vida (docs/PULIDO_ROADMAP.md, inspiración
            Clickie): de un vistazo, en qué punto del viaje está el turno. */}
        <ShiftLifecycleStepper shift={shift} perspective={perspective} className="mt-3" />

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon size={15} className="text-ink/35" />
            {formatShiftRange(shift.start_at, shift.end_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon size={15} className="text-ink/35" />
            {shift.quantity} persona(s)
          </span>
        </div>

        {shift.dress_code && (
          <p className="mt-2 text-xs text-ink/50">Dress code: {shift.dress_code}</p>
        )}

        {/* Mini-mapa + "Cómo llegar"/"Agendar": sólo tiene sentido del lado
            del trabajador (es quien tiene que viajar hasta el local y
            organizarse el día). Del lado del comercio estaba al revés — la
            tarjeta de SU PROPIO turno le ofrecía indicaciones para llegar a
            su propio local, ruido puro (Julieta, 2026-07-29). Se oculta en
            turnos ya terminados/cancelados: no hay nada que agendar de un
            turno que ya pasó. */}
        {perspective === "worker" && !isTerminal && (
          <>
            {shift.latitude != null && shift.longitude != null && (
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-line">
                <MiniMap latitude={shift.latitude} longitude={shift.longitude} />
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {shift.latitude != null && shift.longitude != null && (
                <Button
                  variant="surface"
                  size="sm"
                  fullWidth
                  leftIcon={<RouteIcon size={15} />}
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${shift.latitude},${shift.longitude}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  Cómo llegar
                </Button>
              )}
              <Button
                variant="surface"
                size="sm"
                fullWidth
                leftIcon={<CalendarPlusIcon size={15} />}
                onClick={() => downloadShiftIcs(shift)}
              >
                Agendar
              </Button>
            </div>
          </>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
