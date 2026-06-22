"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";

export default function CompanyProfileForm() {
  const { token } = useAuth();
  const [exists, setExists] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((p) => {
        setExists(true);
        setName(p.name);
        setCity(p.city ?? "");
        setLatitude(p.latitude?.toString() ?? "");
        setLongitude(p.longitude?.toString() ?? "");
      })
      .catch(() => setExists(false))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = {
      name,
      city: city || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
    };
    try {
      exists
        ? await api.put<CompanyProfile>("/companies/me/profile", payload, token)
        : await api.post<CompanyProfile>("/companies/me/profile", payload, token);
      setExists(true);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el perfil");
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Nombre del comercio</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">Ciudad</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Latitud</label>
          <input
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="-34.58"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Longitud</label>
          <input
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="-58.43"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm font-medium text-green-600">Perfil guardado</p>}

      <button
        type="submit"
        className="rounded-full bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
      >
        {exists ? "Guardar cambios" : "Crear perfil"}
      </button>
    </form>
  );
}
