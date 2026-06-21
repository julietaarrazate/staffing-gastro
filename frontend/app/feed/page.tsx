"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";

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
      <h1 className="text-2xl font-bold">Turnos disponibles</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Estos son los turnos publicados cerca de vos. Postulate creando tu perfil completo
        para que el sistema te recomiende a los comercios.
      </p>

      {loading && <p className="mt-8 text-zinc-500">Cargando turnos...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {!loading && shifts.length === 0 && !error && (
        <p className="mt-8 text-zinc-500">No hay turnos publicados todavía.</p>
      )}

      <div className="mt-6 grid gap-4">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    </div>
  );
}
