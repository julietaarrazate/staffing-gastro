"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";
import {
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from "@/components/PageState";
import { CalendarIcon } from "@/components/icons";

export default function FeedPage() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<Shift[]>("/shifts/feed", token)
      .then(setShifts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error al cargar el feed"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title="Turnos disponibles"
        subtitle="Estos son los turnos publicados cerca de vos. Completá tu perfil para que el sistema te recomiende a los comercios."
      />

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} />}
      {!loading && !error && shifts.length === 0 && (
        <EmptyState
          icon={<CalendarIcon size={26} />}
          title="No hay turnos publicados"
          subtitle="Todavía no hay turnos abiertos cerca tuyo. Volvé en un rato: aparecen en tiempo real."
        />
      )}

      <div className="mt-6 grid gap-4">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    </div>
  );
}
