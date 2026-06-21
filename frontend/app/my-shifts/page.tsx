"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Shift } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";
import ShiftCard from "@/components/ShiftCard";

export default function MyAssignedShiftsPage() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/mine", token);
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

  async function confirm(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/confirm`, undefined, token);
    load();
  }

  async function reject(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/reject`, undefined, token);
    load();
  }

  async function depart(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/depart`, undefined, token);
    load();
  }

  async function checkIn(id: string) {
    if (!token) return;
    setGeoError(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      await api.post(`/shifts/${id}/check-in`, { latitude, longitude }, token);
      load();
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "No se pudo marcar la llegada");
    }
  }

  async function startWorking(id: string) {
    if (!token) return;
    await api.post(`/shifts/${id}/start-working`, undefined, token);
    load();
  }

  async function checkOut(id: string) {
    if (!token) return;
    setGeoError(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      await api.post(`/shifts/${id}/check-out`, { latitude, longitude }, token);
      load();
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "No se pudo marcar la salida");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Mis turnos asignados</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Acá aparecen los turnos que un comercio te asignó. Confirmá tu asistencia o rechazá si no podés.
      </p>

      {loading && <p className="mt-8 text-zinc-500">Cargando...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {geoError && <p className="mt-4 text-red-600">{geoError}</p>}
      {!loading && shifts.length === 0 && !error && (
        <p className="mt-8 text-zinc-500">Todavía no tenés turnos asignados.</p>
      )}

      <div className="mt-6 grid gap-4">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift}>
            {shift.status === "asignado" && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => confirm(shift.id)}
                  className="rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => reject(shift.id)}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  Rechazar
                </button>
              </div>
            )}
            {shift.status === "confirmado" && (
              <button
                onClick={() => depart(shift.id)}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                🚗 Salir hacia el turno
              </button>
            )}
            {shift.status === "en_camino" && (
              <button
                onClick={() => checkIn(shift.id)}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                📍 Marcar llegada
              </button>
            )}
            {shift.status === "check_in" && (
              <button
                onClick={() => startWorking(shift.id)}
                className="rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                ▶️ Empezar a trabajar
              </button>
            )}
            {shift.status === "trabajando" && (
              <button
                onClick={() => checkOut(shift.id)}
                className="rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
              >
                📍 Marcar salida
              </button>
            )}
            {shift.status === "check_out" && (
              <p className="text-sm text-zinc-500">Esperando que el comercio cierre el turno.</p>
            )}
            {shift.status === "finalizado" && (
              <p className="text-sm text-zinc-500">Turno finalizado, esperando el pago.</p>
            )}
            {shift.status === "pagado" && (
              <p className="text-sm font-semibold text-green-700">✅ Turno pagado</p>
            )}
          </ShiftCard>
        ))}
      </div>
    </div>
  );
}
