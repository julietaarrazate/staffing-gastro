"use client";

/**
 * Onboarding del trabajador recién registrado: dos pasos, zona y oficio.
 *
 * Antes, al registrarse caía en `/profile` — un formulario largo con foto, bio,
 * años de experiencia, disponibilidad y ubicación, todo junto y sin explicar
 * para qué sirve nada. El feed necesita sólo dos datos para dejar de mostrar
 * turnos irrelevantes: DÓNDE está (rankea por distancia) y QUÉ sabe hacer
 * (filtra por oficio). Todo lo demás — foto incluida — se pide después, cuando
 * tiene sentido para el usuario (la foto recién importa cuando se postula y
 * quiere que lo elijan).
 *
 * Decisión de producto: no se pide foto acá a propósito. Sacarse una foto es
 * la fricción más alta del alta y es donde más gente abandona.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { SKILL_LABELS, WORKER_SKILLS, type WorkerSkill, type WorkerProfile } from "@/lib/types";
import LocationPicker, { type LocationSelection } from "@/components/LocationPicker";
import { Button } from "@/components/ui";
import { CheckIcon, MapPinIcon } from "@/components/icons";

type Step = "zona" | "oficio";

export default function BienvenidaPage() {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("zona");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sólo aplica a trabajadores. Un comercio que caiga acá va a su panel.
  useEffect(() => {
    if (authLoading) return;
    if (!token) router.replace("/login");
    else if (user && user.role !== "worker") router.replace("/shifts");
  }, [authLoading, token, user, router]);

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

  if (authLoading || !token) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-sm flex-col px-5 py-8">
      <StepDots step={step} />

      {step === "zona" ? (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            ¿Dónde querés trabajar?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/55">
            Te mostramos primero los turnos más cerca tuyo. Podés cambiarlo cuando
            quieras desde tu perfil.
          </p>

          <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <LocationPicker onSelect={setLocation} />
          </div>

          {location && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink/70">
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
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            ¿Qué sabés hacer?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/55">
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
                      ? "bg-ink text-white"
                      : "bg-white text-ink/70 ring-1 ring-line"
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
            <Button variant="ghost" fullWidth onClick={() => setStep("zona")}>
              Volver
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="h-1.5 flex-1 rounded-full bg-primary" />
      <span
        className={`h-1.5 flex-1 rounded-full transition-colors ${
          step === "oficio" ? "bg-primary" : "bg-line"
        }`}
      />
    </div>
  );
}
