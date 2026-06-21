import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  borrador: "bg-zinc-200 text-zinc-700",
  publicado: "bg-blue-100 text-blue-700",
  buscando_personal: "bg-blue-100 text-blue-700",
  asignado: "bg-amber-100 text-amber-700",
  confirmado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function ShiftCard({
  shift,
  children,
}: {
  shift: Shift;
  children?: React.ReactNode;
}) {
  const start = new Date(shift.start_at);
  const end = new Date(shift.end_at);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">
            {SKILL_LABELS[shift.position]}
          </h3>
          <p className="text-sm text-zinc-500">
            {shift.city ?? "Ubicación a confirmar"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {shift.urgent && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              🔥 Urgente
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              STATUS_COLORS[shift.status] ?? "bg-zinc-100 text-zinc-700"
            }`}
          >
            {STATUS_LABELS[shift.status]}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
        <span>
          📅 {start.toLocaleDateString("es-AR")} · {start.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} a{" "}
          {end.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span>👥 {shift.quantity} persona(s)</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xl font-extrabold text-orange-600">
          {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
        </p>
        {shift.tips && <span className="text-xs text-zinc-500">+ propinas</span>}
      </div>

      {shift.dress_code && (
        <p className="mt-2 text-xs text-zinc-500">Dress code: {shift.dress_code}</p>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
