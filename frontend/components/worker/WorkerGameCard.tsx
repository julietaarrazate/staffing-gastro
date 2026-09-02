"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerEarnings, WorkerProfile } from "@/lib/types";
import {
  BADGE_ICONS,
  BADGE_LABELS,
  formatRating,
  levelLabel,
  levelMeta,
} from "@/lib/reputation";
import { Avatar, ErrorBanner, Skeleton } from "@/components/ui";
import EditableName from "@/components/EditableName";
import RateMeter from "@/components/RateMeter";
import {
  AwardIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  MedalIcon,
  StarIcon,
  WalletIcon,
  XCircleIcon,
} from "@/components/icons";

// `accent` sigue el mismo criterio que la landing (StatsStrip/bento): manteca
// para el dato operativo, celeste para lo que acumula confianza, y una queda
// neutra a propósito — no todas las tiles llevan color. Ícono sobre `bg-card`
// (blanco en claro, carbón en oscuro): antes usaban `bg-surface`, que en el
// mockup "Híbrido"/"Contraste" es la tarjeta ELEVADA, no el tinte de fondo.
const TILE_MANTECA = "bg-manteca-tint text-manteca-text";
const TILE_CIELO = "bg-cielo-tint text-cielo-text";
const TILE_NEUTRAL = "bg-surface text-ink/60";

function StatTile({
  icon,
  value,
  label,
  accent = TILE_NEUTRAL,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3.5 text-center ring-1 ring-line">
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
      {/* `text-metric` (rediseño 2026-09): antes `text-lg` (18px), la misma
          escala que cualquier título de card — un número de estadística no
          es texto, es un DATO (brief: "los números... deben tener presencia
          visual"), necesita su propio peso. */}
      <span className="text-metric font-extrabold text-ink">{value}</span>
      <span className="text-[11px] font-medium text-ink/50">{label}</span>
    </div>
  );
}

export default function WorkerGameCard() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [earnings, setEarnings] = useState<WorkerEarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<WorkerProfile>("/workers/me/profile", token)
      .then(setProfile)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar tu reputación")
      )
      .finally(() => setLoading(false));
    // Aparte del perfil: si falla, la tarjeta igual se ve completa sin el
    // bloque de ganancias, en vez de tapar toda la reputación por esto.
    api
      .get<WorkerEarnings>("/workers/me/earnings", token)
      .then(setEarnings)
      .catch(() => {});
  }, [token]);

  if (loading) return <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />;
  if (error) return <ErrorBanner message={error} />;
  if (!profile) return null;

  const level = (profile.level ?? "bronce").toLowerCase();
  const meta = levelMeta(level);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-line">
      {/* Hero oscuro estilo Apple Wallet */}
      <div className="relative flex flex-col items-center bg-gradient-to-br from-ink to-[#2f2f33] px-5 pb-5 pt-6 text-white">
        <Avatar src={profile.photo_url} name={user?.full_name ?? "Vos"} size="xl" className="ring-4 ring-white/20" />
        <EditableName className="mt-3 justify-center text-xl font-extrabold" />
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold font-mono uppercase tracking-wide">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> Nivel {levelLabel(level)}
        </span>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-extrabold text-ink">
          <StarIcon size={16} filled className="text-rating" />
          {formatRating(profile.rating)}
        </div>
      </div>

      {/* Ganancias (pedido de Julieta: "un resumen de ganancias acumuladas
          en el perfil"): el dato que más motiva y hoy no se veía en ningún
          lado. Tarjeta `bg-night` (SIEMPRE oscura, en los dos modos — mockup
          "Híbrido"/"Contraste"): es el "módulo de foco" de la identidad
          nueva, el mismo rol que ya cumple el hero de arriba. Ícono naranja
          sólido + monto grande en blanco (jerarquía brutal, mismo criterio
          que el pago en ShiftCard/OpportunityCard); "Este mes" como dato
          secundario en manteca — es un NÚMERO, no una tarjeta de éxito. */}
      {earnings && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-night px-4 py-4">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-primary text-night">
            <WalletIcon size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold font-mono uppercase tracking-wide text-white/60">
              Ganado este mes
            </p>
            <p className="flex items-baseline gap-1 font-display leading-none">
              <span className="text-sm font-semibold text-primary">ARS</span>
              <span className="text-2xl font-semibold text-white">
                {Number(earnings.this_month_earned).toLocaleString("es-AR")}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-right text-xs font-bold text-manteca">
            ARS {Number(earnings.total_earned).toLocaleString("es-AR")}
            <span className="block text-[10px] font-medium text-white/50">total</span>
          </p>
        </div>
      )}

      {/* Puntualidad: proporción contra un límite (100%), no un stat tile de
          texto plano — se muestra como barra con severidad (dataviz skill,
          "single ratio against a limit" → meter). Antes competía en tamaño
          con "Turnos"/"Cancelaciones", que son valores sueltos, no ratios. */}
      <div className="px-4 pt-4">
        <RateMeter
          label="Puntualidad"
          rate={profile.punctuality_rate}
          hasHistory={profile.events_completed > 0}
        />
      </div>

      {/* Stats: manteca en el dato operativo (turnos), celeste en lo que
          acumula confianza (experiencia) — mismo criterio que StatsStrip/el
          bento de la landing. Cancelaciones queda neutra a propósito: no es
          un logro que destacar. */}
      <div className="grid grid-cols-3 gap-2.5 p-4">
        <StatTile
          icon={<BriefcaseIcon size={16} />}
          value={String(profile.events_completed)}
          label="Turnos"
          accent={TILE_MANTECA}
        />
        <StatTile
          icon={<XCircleIcon size={16} />}
          value={String(profile.cancellations)}
          label="Cancelaciones"
        />
        <StatTile
          icon={<CheckCircleIcon size={16} />}
          value={String(profile.years_experience)}
          label="Años exp."
          accent={TILE_CIELO}
        />
      </div>

      {/* Nivel */}
      <div className="px-4 pb-3">
        <div className={`flex items-center gap-2.5 rounded-2xl ${meta.bg} px-3.5 py-2.5 ring-1 ${meta.ring}`}>
          <MedalIcon size={20} className={meta.text} />
          <div className="min-w-0">
            <p className={`text-sm font-extrabold ${meta.text}`}>Nivel {levelLabel(level)}</p>
            <p className="text-xs text-ink/50">Según tu desempeño en turnos completados</p>
          </div>
        </div>
      </div>

      {/* Insignias */}
      <div className="px-4 pb-3">
        <p className="mb-1.5 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">Insignias</p>
        {profile.badges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.badges.map((badge) => {
              const Icon = BADGE_ICONS[badge] ?? AwardIcon;
              return (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary-text"
                >
                  <Icon size={12} /> {BADGE_LABELS[badge] ?? badge}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            Todavía no tenés insignias — completá turnos para ganarlas.
          </p>
        )}
      </div>

      {/* Rubros */}
      {profile.skills.length > 0 && (
        <div className="px-4 pb-5">
          <p className="mb-1.5 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">Rubros</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink/75 ring-1 ring-line">
                {SKILL_LABELS[skill]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
