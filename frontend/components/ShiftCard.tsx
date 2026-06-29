import dynamic from "next/dynamic";
import Link from "next/link";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import { SKILL_STYLES } from "@/lib/skill-style";
import { CalendarIcon, FlameIcon, MapPinIcon, UsersIcon } from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => <div className="h-28 w-full animate-pulse rounded-2xl bg-zinc-100" />,
});

const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-zinc-200 text-zinc-700",
  publicado: "bg-blue-100 text-blue-700",
  buscando_personal: "bg-blue-100 text-blue-700",
  asignado: "bg-amber-100 text-amber-700",
  confirmado: "bg-green-100 text-green-700",
  en_camino: "bg-blue-100 text-blue-700",
  check_in: "bg-purple-100 text-purple-700",
  trabajando: "bg-purple-100 text-purple-700",
  check_out: "bg-amber-100 text-amber-700",
  finalizado: "bg-green-100 text-green-700",
  pagado: "bg-green-200 text-green-800",
  cancelado: "bg-red-100 text-red-700",
};

export default function ShiftCard({
  shift,
  children,
}: {
  shift: Shift;
  children?: React.ReactNode;
}) {
  const { Icon, gradient } = SKILL_STYLES[shift.position];

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99] hover:shadow-lg">
      {shift.company_name && (
        <Link
          href={`/companies/${shift.company_id}`}
          className="flex items-center gap-2 border-b border-zinc-100 px-5 py-2.5 hover:bg-zinc-50"
        >
          {shift.company_logo_url ? (
            <img
              src={shift.company_logo_url}
              alt={shift.company_name}
              loading="lazy"
              decoding="async"
              className="h-7 w-7 rounded-full object-cover ring-1 ring-zinc-100"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
              {shift.company_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-zinc-700">{shift.company_name}</span>
        </Link>
      )}
      <div className={`relative flex h-24 items-end bg-gradient-to-br ${gradient} px-5 pb-3`}>
        <Icon size={64} className="absolute -right-2 -top-2 text-white/15" />
        {shift.urgent && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-red-600 shadow-sm">
            <FlameIcon size={13} /> Urgente
          </span>
        )}
        <div className="relative z-10">
          <h3 className="text-lg font-extrabold leading-tight text-white drop-shadow-sm">
            {SKILL_LABELS[shift.position]}
          </h3>
          <p className="inline-flex items-center gap-1 text-sm font-medium text-white/85">
            <MapPinIcon size={13} />
            {shift.city ?? "Ubicación a confirmar"}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              STATUS_COLORS[shift.status] ?? "bg-zinc-100 text-zinc-700"
            }`}
          >
            {STATUS_LABELS[shift.status]}
          </span>
          <div className="text-right">
            <p className="text-xl font-extrabold text-orange-600">
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            {shift.tips && <p className="text-xs font-medium text-zinc-400">+ propinas</p>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon size={15} className="text-zinc-400" />
            {formatShiftRange(shift.start_at, shift.end_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon size={15} className="text-zinc-400" />
            {shift.quantity} persona(s)
          </span>
        </div>

        {shift.dress_code && (
          <p className="mt-2 text-xs text-zinc-500">Dress code: {shift.dress_code}</p>
        )}

        {shift.latitude != null && shift.longitude != null && (
          <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-zinc-100">
            <MiniMap latitude={shift.latitude} longitude={shift.longitude} />
          </div>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
