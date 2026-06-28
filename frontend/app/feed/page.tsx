"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, Shift, WorkerSkill } from "@/lib/types";
import { SKILL_STYLES } from "@/lib/skill-style";
import ShiftCard from "@/components/ShiftCard";
import { CardSkeletons, EmptyState, ErrorBanner } from "@/components/PageState";
import { CalendarIcon } from "@/components/icons";

export default function FeedPage() {
  const { token, user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkerSkill | "todos">("todos");

  useEffect(() => {
    if (!token) return;
    api
      .get<Shift[]>("/shifts/feed", token)
      .then(setShifts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error al cargar el feed"))
      .finally(() => setLoading(false));
  }, [token]);

  // Sólo ofrecemos como chips los roles que realmente aparecen en el feed,
  // para no mostrar categorías vacías (como hace Morfi con sus categorías).
  const availableSkills = useMemo(() => {
    const present = new Set(shifts.map((s) => s.position));
    return (Object.keys(SKILL_STYLES) as WorkerSkill[]).filter((s) => present.has(s));
  }, [shifts]);

  const visibleShifts = useMemo(
    () => (filter === "todos" ? shifts : shifts.filter((s) => s.position === filter)),
    [shifts, filter]
  );

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="min-h-full">
      {/* Header estilo app: saludo + chips de filtro pegados arriba. */}
      <div className="sticky top-16 z-20 -mt-px bg-zinc-50/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
            {firstName ? `Hola, ${firstName}` : "Turnos disponibles"}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Turnos abiertos cerca tuyo, en tiempo real.
          </p>

          {availableSkills.length > 0 && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip
                active={filter === "todos"}
                onClick={() => setFilter("todos")}
                label="Todos"
              />
              {availableSkills.map((skill) => {
                const { Icon, gradient } = SKILL_STYLES[skill];
                return (
                  <FilterChip
                    key={skill}
                    active={filter === skill}
                    onClick={() => setFilter(skill)}
                    label={SKILL_LABELS[skill]}
                    icon={<Icon size={14} />}
                    gradient={gradient}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-10">
        {loading && <CardSkeletons />}
        {error && <ErrorBanner message={error} />}
        {!loading && !error && shifts.length === 0 && (
          <EmptyState
            icon={<CalendarIcon size={26} />}
            title="No hay turnos publicados"
            subtitle="Todavía no hay turnos abiertos cerca tuyo. Volvé en un rato: aparecen en tiempo real."
          />
        )}
        {!loading && !error && shifts.length > 0 && visibleShifts.length === 0 && (
          <EmptyState
            icon={<CalendarIcon size={26} />}
            title="Sin turnos de ese rol"
            subtitle="No hay turnos abiertos para ese rol ahora mismo. Probá con otro filtro."
          />
        )}

        <div className="mt-4 grid gap-4">
          {visibleShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift}>
              <Link
                href={`/companies/${shift.company_id}`}
                className="text-sm font-semibold text-orange-600 hover:underline"
              >
                Ver el comercio
              </Link>
            </ShiftCard>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
  gradient,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  gradient?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? gradient
            ? `bg-gradient-to-br ${gradient} text-white shadow-md`
            : "bg-zinc-900 text-white shadow-md"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
