"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { SKILL_LABELS, WORKER_SKILLS, WorkerMapResult, WorkerSkill } from "@/lib/types";
import { ErrorBanner, PageHeader } from "@/components/PageState";
import { MapPinIcon } from "@/components/icons";
import { SKILL_STYLES } from "@/lib/skill-style";
import StarRating from "@/components/StarRating";

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

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Rol
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as WorkerSkill | "")}
            className="rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 transition focus:bg-white focus:ring-orange-300"
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
            className="w-24 rounded-xl bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200 transition focus:bg-white focus:ring-orange-300"
          />
        </label>

        <button
          onClick={search}
          disabled={loading}
          className="rounded-full bg-gradient-to-br from-orange-500 to-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/30 transition active:scale-95 hover:shadow-lg disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-6 overflow-hidden rounded-3xl shadow-sm ring-1 ring-zinc-100">
        <WorkerSearchMap center={center} workers={workers} />
      </div>

      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-100">
        <MapPinIcon size={16} className="text-orange-500" />
        {workers.length} trabajador{workers.length === 1 ? "" : "es"} disponible
        {workers.length === 1 ? "" : "s"} en el radio seleccionado.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {workers.map((worker) => (
          <Link
            key={worker.profile_id}
            href={`/workers/${worker.profile_id}`}
            className="flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99] hover:shadow-lg"
          >
            {worker.photo_url ? (
              <img
                src={worker.photo_url}
                alt={worker.full_name}
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-zinc-100"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-200 to-orange-400 text-xl font-bold text-white">
                {worker.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-zinc-800">{worker.full_name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <StarRating value={Math.round(worker.rating)} size={13} />
                <span className="text-xs text-zinc-500">{worker.rating.toFixed(1)}</span>
                {worker.distance_km != null && (
                  <span className="text-xs text-zinc-400">
                    · {worker.distance_km.toFixed(1)} km
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {worker.skills.map((s) => {
                  const { Icon, gradient } = SKILL_STYLES[s];
                  return (
                    <span
                      key={s}
                      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-br ${gradient} px-2 py-0.5 text-xs font-semibold text-white`}
                    >
                      <Icon size={11} /> {SKILL_LABELS[s]}
                    </span>
                  );
                })}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
