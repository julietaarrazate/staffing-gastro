"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerProfile } from "@/lib/types";
import {
  BADGE_ICONS,
  BADGE_LABELS,
  formatPunctuality,
  formatRating,
  levelLabel,
  levelMeta,
} from "@/lib/reputation";
import { Avatar, ErrorBanner, Skeleton } from "@/components/ui";
import {
  AwardIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  MedalIcon,
  StarIcon,
  XCircleIcon,
} from "@/components/icons";

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface px-2 py-3 text-center">
      <span className="text-primary-text">{icon}</span>
      <span className="text-lg font-extrabold leading-none text-ink">{value}</span>
      <span className="text-[11px] font-medium text-ink/50">{label}</span>
    </div>
  );
}

export default function WorkerGameCard() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
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
  }, [token]);

  if (loading) return <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />;
  if (error) return <ErrorBanner message={error} />;
  if (!profile) return null;

  const level = (profile.level ?? "bronce").toLowerCase();
  const meta = levelMeta(level);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
      {/* Hero oscuro estilo Apple Wallet */}
      <div className="relative flex flex-col items-center bg-gradient-to-br from-ink to-[#2f2f33] px-5 pb-5 pt-6 text-white">
        <Avatar src={profile.photo_url} name={user?.full_name ?? "Vos"} size="xl" className="ring-4 ring-white/20" />
        <h2 className="mt-3 text-xl font-extrabold">{user?.full_name}</h2>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wide">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> Nivel {levelLabel(level)}
        </span>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-ink">
          <StarIcon size={16} filled className="text-amber-400" />
          {formatRating(profile.rating)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
        <StatTile
          icon={<BriefcaseIcon size={20} />}
          value={String(profile.events_completed)}
          label="Turnos"
        />
        <StatTile
          icon={<ClockIcon size={20} />}
          value={formatPunctuality(profile.punctuality_rate)}
          label="Puntualidad"
        />
        <StatTile
          icon={<XCircleIcon size={20} />}
          value={String(profile.cancellations)}
          label="Cancelaciones"
        />
        <StatTile
          icon={<CheckCircleIcon size={20} />}
          value={String(profile.years_experience)}
          label="Años exp."
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
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Insignias</p>
        {profile.badges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.badges.map((badge) => {
              const Icon = BADGE_ICONS[badge] ?? AwardIcon;
              return (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-primary-text"
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Rubros</p>
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
