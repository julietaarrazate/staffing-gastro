"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WORKER_SKILLS, WorkerProfile, WorkerSkill } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import ImageUpload from "@/components/ImageUpload";
import { Button, ErrorBanner, Skeleton } from "@/components/ui";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
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
      .catch((err) => {
        // Sólo un 404 real significa "todavía no hay perfil". Cualquier otro
        // error (red, 5xx) NO puede interpretarse como eso: si lo hiciéramos,
        // el próximo submit haría POST y pisaría un perfil existente.
        if (isNotFound(err)) {
          setExists(false);
        } else {
          setLoadError(getErrorMessage(err, "No pudimos cargar tu perfil"));
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
    setSubmitting(true);
    try {
      const result = exists
        ? await api.put<WorkerProfile>("/workers/me/profile", payload, token)
        : await api.post<WorkerProfile>("/workers/me/profile", payload, token);
      setProfile(result);
      setExists(true);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo guardar el perfil"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorBanner message={loadError} onRetry={load} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ImageUpload
        value={photoUrl}
        onChange={setPhotoUrl}
        fallbackLabel={profile?.full_name ?? user?.full_name ?? "T"}
      />


      <div>
        <label className="block text-sm font-medium text-ink/70">Ubicación</label>
        <p className="mt-0.5 text-xs text-ink/50">
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
          <p className="mt-2 text-sm font-medium text-ink/70">
            Tu zona: <span className="text-primary">{city}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink/70">Años de experiencia</label>
        <input
          type="number"
          min={0}
          max={80}
          value={yearsExperience}
          onChange={(e) => setYearsExperience(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink/70">Habilidades</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORKER_SKILLS.map((skill) => (
            <button
              type="button"
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                skills.includes(skill)
                  ? "bg-primary text-white"
                  : "bg-surface text-ink/70 hover:bg-line"
              }`}
            >
              {SKILL_LABELS[skill]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink/70">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
        />
        Disponible para tomar turnos
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm font-medium text-green-600">Perfil guardado</p>}

      <Button type="submit" loading={submitting} disabled={submitting}>
        {exists ? "Guardar cambios" : "Crear perfil"}
      </Button>
    </form>
  );
}
