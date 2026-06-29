"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerProfile } from "@/lib/types";
import { Avatar, Skeleton } from "@/components/ui";
import {
  BoltIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
} from "@/components/icons";

// Gradiente del "nivel" del jugador (gamificación).
const LEVEL_GRADIENT: Record<string, string> = {
  bronce: "from-amber-500 to-orange-700",
  plata: "from-zinc-400 to-zinc-600",
  oro: "from-yellow-400 to-amber-500",
  platino: "from-cyan-400 to-blue-600",
  diamante: "from-fuchsia-500 to-indigo-600",
};

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
      <span className="text-primary">{icon}</span>
      <span className="text-lg font-extrabold leading-none text-zinc-900">{value}</span>
      <span className="text-[11px] font-medium text-zinc-500">{label}</span>
    </div>
  );
}

export default function WorkerGameCard() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<WorkerProfile>("/workers/me/profile", token)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />;
  if (!profile) return null;

  const level = (profile.level ?? "bronce").toLowerCase();
  const gradient = LEVEL_GRADIENT[level] ?? LEVEL_GRADIENT.bronce;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-zinc-100">
      {/* Hero con nivel */}
      <div className={`relative flex flex-col items-center bg-gradient-to-br ${gradient} px-5 pb-5 pt-6 text-white`}>
        <Avatar src={profile.photo_url} name={user?.full_name ?? "Vos"} size="xl" className="ring-4 ring-white/40" />
        <h2 className="mt-3 text-xl font-extrabold">{user?.full_name}</h2>
        <span className="mt-1 rounded-full bg-white/25 px-3 py-0.5 text-xs font-bold uppercase tracking-wide backdrop-blur">
          Nivel {level}
        </span>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm font-extrabold text-zinc-900">
          <StarIcon size={16} filled className="text-amber-400" />
          {profile.rating.toFixed(1)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 p-4">
        <StatTile
          icon={<BriefcaseIcon size={20} />}
          value={String(profile.events_completed)}
          label="Trabajos"
        />
        <StatTile
          icon={<ClockIcon size={20} />}
          value={`${Math.round(profile.punctuality_rate * 100)}%`}
          label="Puntualidad"
        />
        <StatTile
          icon={<CheckCircleIcon size={20} />}
          value={String(profile.years_experience)}
          label="Años exp."
        />
      </div>

      {/* Insignias */}
      {profile.badges.length > 0 && (
        <div className="px-4 pb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Insignias</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700"
              >
                <BoltIcon size={12} /> {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rubros */}
      {profile.skills.length > 0 && (
        <div className="px-4 pb-5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Rubros</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                {SKILL_LABELS[skill]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
