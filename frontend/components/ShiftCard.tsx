import dynamic from "next/dynamic";
import Link from "next/link";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Avatar, Button } from "@/components/ui";
import { CalendarIcon, FlameIcon, MapPinIcon, RouteIcon, UsersIcon } from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-28 w-full animate-pulse rounded-2xl bg-surface" />,
});

// Estados con color semántico, sin violetas. Info en azul, en curso en naranja
// de marca, ok en verde, alerta en rojo.
const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-surface text-ink/60",
  publicado: "bg-blue-50 text-blue-700",
  buscando_personal: "bg-blue-50 text-blue-700",
  asignado: "bg-amber-50 text-amber-700",
  confirmado: "bg-green-50 text-green-700",
  en_camino: "bg-blue-50 text-blue-700",
  check_in: "bg-orange-50 text-primary",
  trabajando: "bg-orange-50 text-primary",
  check_out: "bg-amber-50 text-amber-700",
  finalizado: "bg-green-50 text-green-700",
  pagado: "bg-green-100 text-green-800",
  cancelado: "bg-red-50 text-red-600",
};

export default function ShiftCard({
  shift,
  children,
}: {
  shift: Shift;
  children?: React.ReactNode;
}) {
  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99]">
      {shift.company_name && (
        <Link
          href={`/companies/${shift.company_id}`}
          className="flex items-center gap-2 border-b border-line px-5 py-2.5 hover:bg-surface"
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
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-danger">
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
            <p className="text-xl font-extrabold text-primary">
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            {shift.tips && <p className="text-xs font-medium text-ink/40">+ propinas</p>}
          </div>
        </div>

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

        {shift.latitude != null && shift.longitude != null && (
          <>
            <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-line">
              <MiniMap latitude={shift.latitude} longitude={shift.longitude} />
            </div>
            <Button
              variant="surface"
              size="sm"
              fullWidth
              className="mt-2"
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
          </>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
