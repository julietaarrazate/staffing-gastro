"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WORKER_SKILLS, WorkerProfile, WorkerSkill } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import ImageUpload from "@/components/ImageUpload";
import CvUpload from "@/components/CvUpload";
import { Button, ErrorBanner, Skeleton, TextField, Toggle } from "@/components/ui";
import { CheckCircleIcon, MapPinIcon } from "@/components/icons";

/**
 * Encabezado de sección con ícono de acento (mismo patrón que los
 * `StatTile` de `WorkerGameCard`, escalado a label): sin esto, todo el
 * formulario quedaba en un solo gris monocromo, sin nada del lenguaje de
 * color de la tarjeta de arriba — reporte real de Julieta con captura,
 * "que se vea con color lo que va con color". Sólo dos secciones lo usan
 * (Ubicación, Años de experiencia): son las dos con un acento YA
 * establecido en otro lado (el naranja de "Tu zona" acá abajo, el celeste
 * del mismo dato en el stat tile de WorkerGameCard) — no se inventa color
 * nuevo para el resto.
 */
function FieldHeading({
  icon,
  accent,
  children,
}: {
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-ink/70">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </span>
      {children}
    </p>
  );
}

/** "Español, Inglés" → ["Español", "Inglés"] (limpia vacíos y espacios). */
function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function WorkerProfileForm() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [exists, setExists] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [yearsExperience, setYearsExperience] = useState(0);
  const [bio, setBio] = useState("");
  // Idiomas y certificaciones se editan como texto separado por comas y se
  // guardan como lista (el modelo/API ya los soporta; el form no los exponía).
  const [languagesText, setLanguagesText] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [cvFilename, setCvFilename] = useState<string | null>(null);
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
        setBio(p.bio ?? "");
        setLanguagesText((p.languages ?? []).join(", "));
        setCertificationsText((p.certifications ?? []).join(", "));
        setCvUrl(p.cv_url ?? "");
        setCvFilename(p.cv_filename ?? null);
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
      bio: bio.trim() || null,
      skills,
      years_experience: yearsExperience,
      languages: parseList(languagesText),
      certifications: parseList(certificationsText),
      cv_url: cvUrl.trim() || null,
      cv_filename: cvUrl.trim() ? cvFilename : null,
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
      {/* `compact`: la foto ya se ve grande en el hero de `WorkerGameCard`,
          arriba de este formulario en la misma pantalla — repetirla acá era
          literalmente la misma imagen dos veces (reporte real de Julieta,
          "no puede tener dos veces fotos"). Se deja sólo el control para
          cambiarla, sin la vista previa redundante. */}
      <ImageUpload
        value={photoUrl}
        onChange={setPhotoUrl}
        fallbackLabel={profile?.full_name ?? user?.full_name ?? "T"}
        compact
      />

      <div>
        {/* No es un `<label>`: el selector de abajo es un widget compuesto
            (cascada provincia/localidad), no un único control asociable —
            jsx-a11y/label-has-associated-control, TECH_DEBT.md F4. */}
        <FieldHeading icon={<MapPinIcon size={13} />} accent="bg-primary-tint text-primary-text">
          Ubicación
        </FieldHeading>
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
            Tu zona: <span className="text-primary-text">{city}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldHeading icon={<CheckCircleIcon size={13} />} accent="bg-cielo-tint text-cielo-text">
          Años de experiencia
        </FieldHeading>
        <TextField
          type="number"
          inputMode="numeric"
          min={0}
          max={80}
          value={yearsExperience}
          onChange={(v) => setYearsExperience(Number(v) || 0)}
        />
      </div>

      <div>
        {/* No es un `<label>`: es un grupo de botones toggle, no un único
            control — `role="group"` + `aria-labelledby` es el patrón
            correcto para que un lector de pantalla anuncie el conjunto
            (jsx-a11y/label-has-associated-control, TECH_DEBT.md F4). */}
        <p id="worker-skills-heading" className="block text-sm font-medium text-ink/70">
          Habilidades
        </p>
        <div role="group" aria-labelledby="worker-skills-heading" className="mt-2 flex flex-wrap gap-2">
          {WORKER_SKILLS.map((skill) => {
            const active = skills.includes(skill);
            return (
              <button
                type="button"
                key={skill}
                aria-pressed={active}
                onClick={() => toggleSkill(skill)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-night"
                    : "bg-surface text-ink/70 hover:bg-line"
                }`}
              >
                {SKILL_LABELS[skill]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Perfil profesional: lo que el comercio ve para decidir a quién
          contratar. El modelo/API ya soportaba estos campos; antes el form no
          los dejaba cargar, así que el perfil se veía pobre aunque hubiera
          datos para mostrar. */}
      <div>
        <label htmlFor="worker-bio" className="block text-sm font-medium text-ink/70">
          Sobre mí
        </label>
        <p className="mt-0.5 text-xs text-ink/50">
          Contá tu experiencia en una o dos líneas — es lo primero que lee el comercio.
        </p>
        <textarea
          id="worker-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ej: Mozo con 5 años en cafeterías de especialidad, experiencia en barra y salón."
          className="mt-2 w-full rounded-[var(--radius-input)] bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <TextField
        label="Idiomas"
        value={languagesText}
        onChange={setLanguagesText}
        placeholder="Ej: Español, Inglés"
      />

      <TextField
        label="Certificaciones"
        value={certificationsText}
        onChange={setCertificationsText}
        placeholder="Ej: Manipulación de alimentos, Carnet de manipulador"
      />

      <CvUpload
        value={cvUrl}
        fileName={cvFilename}
        token={token}
        onChange={(url, name) => {
          setCvUrl(url);
          setCvFilename(name);
        }}
      />

      <Toggle
        label="Disponible para tomar turnos"
        checked={isAvailable}
        onChange={setIsAvailable}
      />

      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
      {saved && <p className="text-sm font-medium text-success-text">Perfil guardado</p>}

      <Button type="submit" loading={submitting} disabled={submitting}>
        {exists ? "Guardar cambios" : "Crear perfil"}
      </Button>
    </form>
  );
}
