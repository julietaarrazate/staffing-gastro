"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WORKER_SKILLS, WorkerProfile, WorkerSkill } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import ImageUpload from "@/components/ImageUpload";

export default function WorkerProfileForm() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [exists, setExists] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [yearsExperience, setYearsExperience] = useState(0);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<WorkerProfile>("/workers/me/profile", token)
      .then((p) => {
        setProfile(p);
        setExists(true);
        setPhotoUrl(p.photo_url);
        setCity(p.city ?? "");
        setSkills(p.skills);
        setYearsExperience(p.years_experience);
        setLatitude(p.latitude ?? null);
        setLongitude(p.longitude ?? null);
        setIsAvailable(p.is_available);
      })
      .catch(() => setExists(false))
      .finally(() => setLoading(false));
  }, [token]);

  function toggleSkill(skill: WorkerSkill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = {
      photo_url: photoUrl,
      city: city || null,
      skills,
      years_experience: yearsExperience,
      latitude,
      longitude,
      is_available: isAvailable,
    };
    try {
      const result = exists
        ? await api.put<WorkerProfile>("/workers/me/profile", payload, token)
        : await api.post<WorkerProfile>("/workers/me/profile", payload, token);
      setProfile(result);
      setExists(true);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el perfil");
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ImageUpload
        value={photoUrl}
        onChange={setPhotoUrl}
        fallbackLabel={profile?.full_name ?? user?.full_name ?? "T"}
      />


      <div>
        <label className="block text-sm font-medium text-zinc-700">Ubicación</label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Tu zona define a qué turnos te recomendamos primero (los más cercanos).
        </p>
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
            Tu zona: <span className="text-orange-600">{city}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Años de experiencia</label>
        <input
          type="number"
          min={0}
          max={80}
          value={yearsExperience}
          onChange={(e) => setYearsExperience(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Habilidades</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORKER_SKILLS.map((skill) => (
            <button
              type="button"
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                skills.includes(skill)
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {SKILL_LABELS[skill]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
        />
        Disponible para tomar turnos
      </label>

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
