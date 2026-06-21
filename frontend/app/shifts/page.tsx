"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";

export default function MyShiftsPage() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/me", token);
      setShifts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus turnos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function publish(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/publish`, undefined, token);
    load();
  }

  async function cancel(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/cancel`, undefined, token);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis turnos</h1>
        <Link
          href="/shifts/new"
          className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          + Publicar turno
        </Link>
      </div>

      {loading && <p className="mt-8 text-zinc-500">Cargando...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {!loading && shifts.length === 0 && !error && (
        <p className="mt-8 text-zinc-500">Todavía no publicaste ningún turno.</p>
      )}

      <div className="mt-6 grid gap-4">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift}>
            <div className="flex flex-wrap gap-2">
              {shift.status === "borrador" && (
                <button
                  onClick={() => publish(shift.id)}
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Publicar
                </button>
              )}
              {(shift.status === "publicado" || shift.status === "buscando_personal") && (
                <Link
                  href={`/shifts/${shift.id}/candidates`}
                  className="rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Ver candidatos
                </Link>
              )}
              {!["finalizado", "pagado", "cancelado"].includes(shift.status) && (
                <button
                  onClick={() => cancel(shift.id)}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  Cancelar
                </button>
              )}
            </div>
          </ShiftCard>
        ))}
      </div>
    </div>
  );
}
