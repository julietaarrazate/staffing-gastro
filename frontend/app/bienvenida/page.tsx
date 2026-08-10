"use client";

/**
 * Onboarding del usuario recién registrado, distinto por rol.
 *
 * Trabajador: dos pasos, zona y oficio. Antes, al registrarse caía en
 * `/profile` — un formulario largo con foto, bio, años de experiencia,
 * disponibilidad y ubicación, todo junto y sin explicar para qué sirve nada.
 * El feed necesita sólo dos datos para dejar de mostrar turnos irrelevantes:
 * DÓNDE está (rankea por distancia) y QUÉ sabe hacer (filtra por oficio).
 * Todo lo demás — foto incluida — se pide después, cuando tiene sentido para
 * el usuario (la foto recién importa cuando se postula y quiere que lo elijan).
 *
 * Comercio: dos pasos, nombre y ubicación (auditoría de producto 2026-08-10,
 * C4). Antes caía directo en `/shifts` sin haber cargado nada — el nombre
 * quedaba vacío (los candidatos veían "Un comercio cerca tuyo" en vez del
 * nombre real) y la ubicación nunca se pedía de entrada, así que cada turno
 * se publicaba como si el comercio recién apareciera. Mismo criterio que el
 * trabajador: el logo es opcional y se puede saltear (alta fricción, no es
 * indispensable para publicar el primer turno).
 *
 * Decisión de producto compartida: no se pide foto/logo a propósito en el
 * primer paso obligatorio. Sacarse o subir una foto es la fricción más alta
 * del alta y es donde más gente abandona.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import {
  SKILL_LABELS,
  WORKER_SKILLS,
  type WorkerSkill,
  type WorkerProfile,
  type CompanyProfile,
} from "@/lib/types";
import LocationPicker, { type LocationSelection } from "@/components/LocationPicker";
import MapAddressPicker, { type MapAddressSelection } from "@/components/map/MapAddressPicker";
import ImageUpload from "@/components/ImageUpload";
import Logo from "@/components/Logo";
import { Button, TextField } from "@/components/ui";
import { CheckIcon, MapPinIcon } from "@/components/icons";

export default function BienvenidaPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!token) router.replace("/login");
  }, [authLoading, token, router]);

  if (authLoading || !token || !user) return null;
  if (user.role === "employer") return <EmployerOnboarding />;
  return <WorkerOnboarding />;
}

/** Envoltorio común: mismo fondo, logo y layout que ambos onboardings comparten. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mb-20 flex min-h-[100dvh] flex-col bg-ink px-5 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] text-white md:mb-0">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Logo size={34} withWordmark={false} />
        {children}
      </div>
    </div>
  );
}

function StepDots({ active }: { active: 0 | 1 }) {
  return (
    <div className="mt-6 flex items-center gap-2" aria-hidden>
      <span className="h-1.5 flex-1 rounded-full bg-primary" />
      <span
        className={`h-1.5 flex-1 rounded-full transition-colors ${
          active === 1 ? "bg-primary" : "bg-white/20"
        }`}
      />
    </div>
  );
}

type WorkerStep = "zona" | "oficio";

function WorkerOnboarding() {
  const { token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WorkerStep>("zona");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSkill(skill: WorkerSkill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function finish() {
    if (!token || !location || skills.length === 0) return;
    setError(null);
    setSaving(true);
    // El perfil todavía no existe (el usuario se acaba de registrar), pero si
    // entró dos veces al onboarding puede existir: POST y, si ya está, PUT.
    const payload = {
      photo_url: null,
      city: location.city,
      skills,
      years_experience: 0,
      latitude: location.latitude,
      longitude: location.longitude,
      is_available: true,
    };
    try {
      try {
        await api.post<WorkerProfile>("/workers/me/profile", payload, token);
      } catch {
        await api.put<WorkerProfile>("/workers/me/profile", payload, token);
      }
      router.replace("/feed");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos guardar tus datos. Probá de nuevo."));
      setSaving(false);
    }
  }

  return (
    <Shell>
      <StepDots active={step === "zona" ? 0 : 1} />

      {step === "zona" ? (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white">
            ¿Dónde querés trabajar?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">
            Te mostramos primero los turnos más cerca tuyo. Podés cambiarlo cuando
            quieras desde tu perfil.
          </p>

          <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <LocationPicker onSelect={setLocation} />
          </div>

          {location && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-white/80">
              <MapPinIcon size={16} className="text-primary" />
              {location.city}
            </p>
          )}

          <div className="mt-auto pt-8">
            <Button fullWidth disabled={!location} onClick={() => setStep("oficio")}>
              Continuar
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white">
            ¿Qué sabés hacer?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">
            Elegí todo lo que puedas cubrir. Cuantos más elijas, más turnos vas a ver.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {WORKER_SKILLS.map((skill) => {
              const active = skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSkill(skill)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                    active
                      ? "bg-primary text-ink"
                      : "bg-white/10 text-white/80 ring-1 ring-white/15"
                  }`}
                >
                  {active && <CheckIcon size={15} />}
                  {SKILL_LABELS[skill]}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button
              fullWidth
              disabled={skills.length === 0}
              loading={saving}
              onClick={finish}
            >
              Ver turnos cerca mío
            </Button>
            <button
              type="button"
              onClick={() => setStep("zona")}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-white/60 transition active:scale-[0.98]"
            >
              Volver
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}

type EmployerStep = "nombre" | "ubicacion";

function EmployerOnboarding() {
  const { token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<EmployerStep>("nombre");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [useManualPicker, setUseManualPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (!token || !name.trim() || latitude === null || longitude === null) return;
    setError(null);
    setSaving(true);
    // El perfil todavía no existe (el usuario se acaba de registrar), pero si
    // entró dos veces al onboarding puede existir: POST y, si ya está, PUT.
    const payload = {
      name: name.trim(),
      logo_url: logoUrl,
      address: address || null,
      city: city || null,
      latitude,
      longitude,
    };
    try {
      try {
        await api.post<CompanyProfile>("/companies/me/profile", payload, token);
      } catch {
        await api.put<CompanyProfile>("/companies/me/profile", payload, token);
      }
      router.replace("/shifts/new");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos guardar tus datos. Probá de nuevo."));
      setSaving(false);
    }
  }

  return (
    <Shell>
      <StepDots active={step === "nombre" ? 0 : 1} />

      {step === "nombre" ? (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white">
            ¿Cómo se llama tu comercio?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">
            Es lo primero que ven los candidatos cuando les llega tu turno.
          </p>

          <div className="mt-6 flex justify-center">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              fallbackLabel={name || "C"}
              shape="square"
            />
          </div>

          <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <TextField
              label="Nombre del comercio"
              value={name}
              onChange={setName}
              placeholder="Ej: Bar El Patio"
              maxLength={255}
            />
          </div>

          <div className="mt-auto pt-8">
            <Button fullWidth disabled={!name.trim()} onClick={() => setStep("ubicacion")}>
              Continuar
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white">
            ¿Dónde está?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">
            Los turnos que publiques van a mostrar esta dirección, y les ordena
            la cercanía a los trabajadores.
          </p>

          <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            {useManualPicker ? (
              <div className="flex flex-col gap-2">
                <LocationPicker
                  onSelect={(loc: LocationSelection) => {
                    setCity(loc.city);
                    setLatitude(loc.latitude);
                    setLongitude(loc.longitude);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setUseManualPicker(false)}
                  className="w-fit text-xs font-medium text-ink/40 underline decoration-zinc-200 underline-offset-2 hover:text-ink/60"
                >
                  Volver a buscar en el mapa
                </button>
              </div>
            ) : (
              <MapAddressPicker
                initial={{ address, city, latitude: latitude ?? undefined, longitude: longitude ?? undefined }}
                onChange={(loc: MapAddressSelection) => {
                  setAddress(loc.address);
                  setCity(loc.city);
                  setLatitude(loc.latitude);
                  setLongitude(loc.longitude);
                }}
                onFallback={() => setUseManualPicker(true)}
              />
            )}
          </div>

          {city && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-white/80">
              <MapPinIcon size={16} className="text-primary" />
              {city}
            </p>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button
              fullWidth
              disabled={latitude === null || longitude === null}
              loading={saving}
              onClick={finish}
            >
              Publicar mi primer turno
            </Button>
            <button
              type="button"
              onClick={() => setStep("nombre")}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-white/60 transition active:scale-[0.98]"
            >
              Volver
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
