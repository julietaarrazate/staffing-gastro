"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import ImageUpload from "@/components/ImageUpload";

export default function CompanyProfileForm() {
  const { token } = useAuth();
  const [exists, setExists] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
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
        setLogoUrl(p.logo_url);
        setCity(p.city ?? "");
        setLatitude(p.latitude ?? null);
        setLongitude(p.longitude ?? null);
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
      logo_url: logoUrl,
      city: city || null,
      latitude,
      longitude,
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
      <ImageUpload value={logoUrl} onChange={setLogoUrl} fallbackLabel={name || "C"} shape="square" />

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
        <label className="block text-sm font-medium text-zinc-700">Ubicación del comercio</label>
        <div className="mt-2">
          <LocationPicker
            onSelect={(loc: LocationSelection) => {
              setCity(loc.city);
              setLatitude(loc.latitude);
              setLongitude(loc.longitude);
            }}
          />
        </div>
        {city && (
          <p className="mt-2 text-sm font-medium text-zinc-700">
            Ubicación: <span className="text-orange-600">{city}</span>
          </p>
        )}
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
