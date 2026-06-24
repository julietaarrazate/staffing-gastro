"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WORKER_SKILLS, WorkerMapResult, WorkerSkill } from "@/lib/types";
import { ErrorBanner, PageHeader } from "@/components/PageState";
import { MapPinIcon } from "@/components/icons";

const WorkerSearchMap = dynamic(() => import("@/components/WorkerSearchMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] w-full animate-pulse rounded-2xl bg-zinc-100" />
  ),
});

// Centro por defecto: Obelisco (CABA), por si el navegador no comparte ubicación.
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

export default function SearchPage() {
  const { token } = useAuth();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [skill, setSkill] = useState<WorkerSkill | "">("");
  const [radiusKm, setRadiusKm] = useState(15);
  const [workers, setWorkers] = useState<WorkerMapResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {
        // Sin permiso o sin soporte: nos quedamos con el centro por defecto.
      }
    );
  }, []);

  async function search() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        latitude: String(center[0]),
        longitude: String(center[1]),
        radius_km: String(radiusKm),
      });
      if (skill) params.set("skill", skill);
      const results = await api.get<WorkerMapResult[]>(
        `/matching/search?${params.toString()}`,
        token
      );
      setWorkers(results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo buscar trabajadores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, center]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Buscar trabajadores"
        subtitle="Explorá quién está disponible cerca, filtrando por rol y distancia."
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Rol
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as WorkerSkill | "")}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">Todos los roles</option>
            {WORKER_SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Radio (km)
          <input
            type="number"
            min={1}
            max={100}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>

        <button
          onClick={search}
          disabled={loading}
          className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-6">
        <WorkerSearchMap center={center} workers={workers} />
      </div>

      <p className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-500">
        <MapPinIcon size={16} />
        {workers.length} trabajador{workers.length === 1 ? "" : "es"} disponible
        {workers.length === 1 ? "" : "s"} en el radio seleccionado.
      </p>
    </div>
  );
}
