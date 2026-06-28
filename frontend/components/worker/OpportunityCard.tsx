"use client";

import Link from "next/link";
import { SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_STYLES } from "@/lib/skill-style";
import { Avatar } from "@/components/ui";
import {
  CalendarIcon,
  FlameIcon,
  MapPinIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";

/**
 * Tarjeta grande de oportunidad (turno) para el Inicio del Worker estilo
 * Tinder. Ocupa casi toda la pantalla: hero con el rubro, datos clave y un
 * acceso al detalle del comercio.
 */
export default function OpportunityCard({ shift }: { shift: Shift }) {
  const { Icon, gradient } = SKILL_STYLES[shift.position];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-float)] ring-1 ring-zinc-100">
      {/* Hero con identidad del rubro */}
      <div className={`relative flex flex-[1.1] flex-col justify-between bg-gradient-to-br ${gradient} p-5`}>
        <Icon size={120} className="pointer-events-none absolute -right-4 -top-4 text-white/15" />
        <div className="flex items-center justify-between">
          <Link
            href={`/companies/${shift.company_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-sm"
          >
            <Avatar src={shift.company_logo_url} name={shift.company_name ?? "Comercio"} size="sm" />
            <span className="text-sm font-bold text-zinc-800">
              {shift.company_name ?? "Comercio"}
            </span>
          </Link>
          {shift.urgent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-danger shadow-sm">
              <FlameIcon size={13} /> Urgente
            </span>
          )}
        </div>
        <div className="relative z-10 text-white drop-shadow">
          <h2 className="text-3xl font-extrabold leading-tight">
            {SKILL_LABELS[shift.position]}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-white/90">
            <MapPinIcon size={15} />
            {shift.city ?? "Ubicación a confirmar"}
          </p>
        </div>
      </div>

      {/* Datos clave */}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pago</p>
            <p className="inline-flex items-center gap-1.5 text-3xl font-extrabold text-primary">
              <WalletIcon size={22} className="text-primary" />
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            {shift.tips && <p className="text-xs font-medium text-zinc-400">+ propinas</p>}
          </div>
        </div>

        <div className="space-y-2.5 text-[15px] text-zinc-700">
          <p className="inline-flex items-center gap-2">
            <CalendarIcon size={18} className="text-zinc-400" />
            {formatShiftRange(shift.start_at, shift.end_at)}
          </p>
          <p className="inline-flex items-center gap-2">
            <UsersIcon size={18} className="text-zinc-400" />
            {shift.quantity} {shift.quantity === 1 ? "persona" : "personas"}
          </p>
          {shift.dress_code && (
            <p className="text-sm text-zinc-500">Dress code: {shift.dress_code}</p>
          )}
        </div>
      </div>
    </div>
  );
}
