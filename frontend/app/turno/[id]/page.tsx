import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { SKILL_LABELS, ShiftPublic } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { formatShiftRange } from "@/lib/datetime";
import { buildShiftSummary } from "@/lib/shift-share";
import ShareShiftButton from "@/components/ShareShiftButton";
import { CalendarIcon, MapPinIcon } from "@/components/icons";

/**
 * Página pública de un turno (sin autenticación) — pensada para compartirse
 * por WhatsApp/redes. Consume `GET /shifts/{id}/public`, que sólo devuelve
 * turnos en estado PUBLICADO con campos seguros (ni contacto del comercio,
 * ni postulantes, ver `backend/app/modules/shift/api/routes.py`).
 */

async function getPublicShift(id: string): Promise<ShiftPublic | null> {
  try {
    return await api.get<ShiftPublic>(`/shifts/${id}/public`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getPublicUrl(id: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "staffya.com.ar";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/turno/${id}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shift = await getPublicShift(id);

  if (!shift) {
    return { title: "Turno no encontrado — Staffya" };
  }

  const title = `Buscamos ${SKILL_LABELS[shift.position]}${
    shift.company_name ? ` en ${shift.company_name}` : ""
  } — Staffya`;
  const description = buildShiftSummary(shift);
  const url = await getPublicUrl(id);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Staffya",
      locale: "es_AR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shift = await getPublicShift(id);

  if (!shift) {
    notFound();
  }

  const { Icon, bg, fg } = SKILL_ACCENT[shift.position];

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-8">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
        <div className="px-5 pb-5 pt-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bg} ${fg}`}>
              <Icon size={28} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold leading-tight text-ink">
                {SKILL_LABELS[shift.position]}
              </h1>
              {shift.company_name && (
                <p className="text-sm font-semibold text-ink/60">{shift.company_name}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm text-ink/70">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon size={16} className="text-ink/35" />
              {formatShiftRange(shift.start_at, shift.end_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon size={16} className="text-ink/35" />
              {shift.city ?? "Zona a confirmar"}
            </span>
          </div>

          <div className="mt-5 rounded-2xl bg-surface px-4 py-3.5 text-center">
            <p className="text-2xl font-extrabold text-primary-text">
              {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
            </p>
            <p className="text-xs font-medium text-ink/50">Pago ofrecido</p>
          </div>

          {/* Quien llega por un link compartido casi siempre es un trabajador
              buscando el turno: preseleccionamos su rol en el registro
              (`?rol=trabajador`, mismo patrón que los CTA de la landing) para
              no hacerlo elegir de más y no perderlo en la pestaña equivocada. */}
          <Link
            href="/register?rol=trabajador"
            className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-full bg-primary px-6 text-base font-bold text-ink shadow-[0_8px_20px_rgba(255,107,0,0.28)] transition active:scale-[0.98]"
          >
            Postulate en Staffya
          </Link>
          <p className="mt-3 text-center text-xs text-ink/40">
            Creá tu perfil gratis y postulate a este y otros turnos gastronómicos.
          </p>

          {/* Re-compartir: quien recibe el link puede pasarlo a otro colega
              (loop de difusión). Reusa el mismo botón y la misma pieza de
              share que el feed y el panel del comercio. */}
          <div className="mt-4 flex justify-center border-t border-line pt-4">
            <ShareShiftButton shift={shift} shiftId={shift.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
