"use client";

/**
 * Onboarding del usuario recién registrado, distinto por rol.
 *
 * Trabajador: tres pasos, zona, oficio y "contanos más" (foto + años de
 * experiencia, los dos opcionales). Antes, al registrarse caía en `/profile`
 * — un formulario largo con foto, bio, años de experiencia, disponibilidad
 * y ubicación, todo junto y sin explicar para qué sirve nada. El feed
 * necesita sólo DÓNDE está (rankea por distancia) y QUÉ sabe hacer (filtra
 * por oficio) para dejar de mostrar turnos irrelevantes — completarlos de
 * entrada sigue siendo lo esperado, pero "Dejar para después" (paso 1,
 * mismo pedido de Julieta que el "Omitir por ahora" del comercio, ver
 * abajo) permite salir sin cargarlos: el feed no se rompe sin ellos
 * (`skills=[]`/sin ubicación ya se tratan como "sin filtro" del lado del
 * backend, no como error), sólo queda sin personalizar hasta que el
 * trabajador complete el perfil. El tercer paso (pedido explícito de
 * Julieta: el onboarding quedaba "muy breve") suma la foto y la
 * experiencia sin bloquear el avance si se saltean — un perfil con menos
 * datos igual entra al feed, sólo que un comercio lo ve con menos
 * contexto al postularse.
 *
 * Comercio: dos pasos, nombre y ubicación (auditoría de producto 2026-08-10,
 * C4). Antes caía directo en `/shifts` sin haber cargado nada — el nombre
 * quedaba vacío (los candidatos veían "Un comercio cerca tuyo" en vez del
 * nombre real) y la ubicación nunca se pedía de entrada, así que cada turno
 * se publicaba como si el comercio recién apareciera. Mismo criterio que el
 * trabajador: el logo es opcional y se puede saltear (alta fricción, no es
 * indispensable para publicar el primer turno). El nombre sí es obligatorio
 * (única exigencia real del backend); la ubicación se puede "Cargar después"
 * desde el paso 2 y completar el perfil solo se guarda con lo que haya.
 *
 * Termina en `/shifts` (el panel, con "+ Publicar"/"+ Evento" ya visibles),
 * no en `/shifts/new` directo — probado en vivo por Julieta con una cuenta
 * invitada: el botón "Publicar mi primer turno" empujaba a publicar sin
 * pensar si hacía falta (arriesgando gastar un turno del plan free en una
 * prueba), y "Volver" sólo daba vueltas entre los dos pasos del onboarding
 * sin ninguna salida real hacia la app (docs/STATUS.md 2026-08-11).
 *
 * "Omitir por ahora" en el paso 1 (nombre): mismo pedido de Julieta, un paso
 * más allá — poder saltear el onboarding completo, no sólo la ubicación.
 * Guarda un nombre placeholder ("Mi comercio", editable después desde el
 * perfil) en vez de dejar el perfil sin nombre — evita reintroducir el bug
 * que el `name` obligatorio ya había arreglado (ver párrafo de arriba).
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
import { WelcomeIllustration } from "@/components/illustrations";

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

/** Envoltorio común: mismo fondo, logo y layout que ambos onboardings comparten.
 * Fondo cálido de la app, no un bloque sólido oscuro (retirado, feedback real
 * de Julieta comparando con Pasito: un fondo oscuro sostenido durante todo un
 * wizard de varios pasos "sobrecarga y apaga" — el patrón que funciona es
 * superficie clara con acentos puntuales en tarjetas, no un lienzo entero
 * pintado). El Espresso de ADR-0011 pasa del fondo al ícono de bienvenida
 * (ver más abajo), que sigue siendo el "momento de marca" del primer paso
 * pero como acento, no como pantalla completa. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mb-20 flex min-h-[100dvh] flex-col bg-paper px-5 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] text-ink md:mb-0">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Logo size={34} withWordmark={false} />
        {children}
      </div>
    </div>
  );
}

function StepDots({ active, total }: { active: number; total: number }) {
  return (
    <div className="mt-6 flex items-center gap-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= active ? "bg-primary" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

type WorkerStep = "zona" | "oficio" | "detalles";

function WorkerOnboarding() {
  const { token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WorkerStep>("zona");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Texto crudo, no número: arrancar en 0 dejaba un "0" pegado en el campo
  // que el teclado numérico de Android no siempre reemplazaba solo al
  // escribir encima (quedaba "05" en vez de "5") — reporte real de Julieta,
  // "sacalo que la gente ponga los años". Vacío de entrada, con "0" sólo
  // como placeholder; se convierte a número recién al mandar el form.
  const [yearsExperienceInput, setYearsExperienceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [skippingAll, setSkippingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSkill(skill: WorkerSkill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  // `withDetails=false` es lo que usa `skipAll()`: guarda un perfil vacío
  // (sin zona, sin oficio) en vez de bloquear la salida del onboarding
  // hasta completar los dos — pedido real de Julieta ("un botón dejar
  // para después por si no quieren llenar en el momento"). No rompe el
  // feed: `skills=[]` y sin ubicación ya se tratan como "sin filtro/sin
  // orden por cercanía" del lado del backend (`get_my_worker_skills`,
  // `shift/api/dependencies.py`), no como error.
  async function save(withDetails: boolean): Promise<boolean> {
    if (!token) return false;
    setError(null);
    // El perfil todavía no existe (el usuario se acaba de registrar), pero si
    // entró dos veces al onboarding puede existir: POST y, si ya está, PUT.
    const payload = {
      photo_url: withDetails ? photoUrl : null,
      city: withDetails ? (location?.city ?? null) : null,
      skills: withDetails ? skills : [],
      years_experience: withDetails ? Number(yearsExperienceInput) || 0 : 0,
      latitude: withDetails ? (location?.latitude ?? null) : null,
      longitude: withDetails ? (location?.longitude ?? null) : null,
      is_available: true,
    };
    try {
      try {
        await api.post<WorkerProfile>("/workers/me/profile", payload, token);
      } catch {
        await api.put<WorkerProfile>("/workers/me/profile", payload, token);
      }
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos guardar tus datos. Probá de nuevo."));
      return false;
    }
  }

  async function finish() {
    // `photo_url`/`years_experience` son opcionales — un trabajador que
    // saltea el paso "Contanos más" igual entra al feed, sólo que el
    // comercio lo ve con menos contexto al postularse.
    if (!location || skills.length === 0) return;
    setSaving(true);
    if (await save(true)) router.replace("/feed");
    else setSaving(false);
  }

  // Salida completa del onboarding desde el paso 1, sin zona ni oficio
  // todavía (mismo criterio que `skipAll` del comercio, unas líneas más
  // abajo en este archivo): el feed queda sin filtrar/sin ordenar por
  // cercanía hasta que complete el perfil, pero no se lo deja trabado acá.
  async function skipAll() {
    setSkippingAll(true);
    if (await save(false)) router.replace("/feed");
    else setSkippingAll(false);
  }

  const stepIndex = step === "zona" ? 0 : step === "oficio" ? 1 : 2;

  return (
    <Shell>
      <StepDots active={stepIndex} total={3} />

      {step === "zona" ? (
        <section className="mt-8 flex flex-1 flex-col">
          {/* "El gesto previo a empezar" (ART_DIRECTION.md §10.4) — sólo en
              el primer paso, como un saludo de bienvenida, no en cada paso
              del wizard. */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-structure)]">
            <WelcomeIllustration size={32} color="#f94e1b" />
          </div>
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            ¿Dónde querés trabajar?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
            Te mostramos primero los turnos más cerca tuyo. Podés cambiarlo cuando
            quieras desde tu perfil.
          </p>

          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <LocationPicker onSelect={setLocation} />
          </div>

          {location && (
            // Celeste, no naranja: confirma una ubicación ya verificada, el
            // mismo rol de "confianza" que cumple el celeste en el resto de
            // la app (ADR-0011) — el naranja sigue siendo sólo de acción.
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink/70">
              <MapPinIcon size={16} className="text-cielo-text" />
              {location.city}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button fullWidth disabled={!location} onClick={() => setStep("oficio")}>
              Continuar
            </Button>
            <button
              type="button"
              disabled={skippingAll}
              onClick={skipAll}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/50 transition active:scale-[0.98] disabled:opacity-60"
            >
              {skippingAll ? "Guardando…" : "Dejar para después"}
            </button>
          </div>
        </section>
      ) : step === "oficio" ? (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            ¿Qué sabés hacer?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
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
                      ? "bg-primary text-night"
                      : "bg-card text-ink/70 ring-1 ring-line hover:bg-surface"
                  }`}
                >
                  {active && <CheckIcon size={15} />}
                  {SKILL_LABELS[skill]}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button fullWidth disabled={skills.length === 0} onClick={() => setStep("detalles")}>
              Continuar
            </Button>
            <button
              type="button"
              onClick={() => setStep("zona")}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/50 transition active:scale-[0.98]"
            >
              Volver
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            Contanos más de vos
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
            Opcional, pero un perfil completo consigue turnos más rápido. Lo podés
            cargar después si preferís arrancar ya.
          </p>

          <div className="mt-6 flex justify-center">
            <ImageUpload
              value={photoUrl}
              onChange={setPhotoUrl}
              fallbackLabel="T"
            />
          </div>

          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <TextField
              label="Años de experiencia"
              type="number"
              inputMode="numeric"
              placeholder="0"
              min={0}
              max={80}
              value={yearsExperienceInput}
              onChange={(v) => setYearsExperienceInput(v.replace(/[^0-9]/g, "").slice(0, 2))}
            />
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button fullWidth loading={saving} onClick={finish}>
              Ver turnos cerca mío
            </Button>
            <button
              type="button"
              onClick={() => setStep("oficio")}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/50 transition active:scale-[0.98]"
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
  const [skipping, setSkipping] = useState(false);
  const [skippingAll, setSkippingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `latitude`/`longitude` son opcionales en el backend (sólo `name` es
  // obligatorio) — permite terminar sin ubicación en vez de dejar al
  // comercio sin salida del onboarding si no la quiere cargar ahora
  // (Julieta, prueba en vivo: "volver atrás te hace volver a cómo se llama
  // tu comercio, pero no va a la app"). `nameOverride` existe sólo para
  // `skipAll()`: necesita mandar un nombre placeholder sin esperar a que el
  // estado de `name` se actualice. Devuelve `false` si falló, para que cada
  // botón decida cómo reaccionar sin duplicar el guardado.
  async function save(withLocation: boolean, nameOverride?: string): Promise<boolean> {
    const finalName = (nameOverride ?? name).trim();
    if (!token || !finalName) return false;
    setError(null);
    const payload = {
      name: finalName,
      logo_url: logoUrl,
      address: withLocation ? address || null : null,
      city: withLocation ? city || null : null,
      latitude: withLocation ? latitude : null,
      longitude: withLocation ? longitude : null,
    };
    try {
      // El perfil todavía no existe (el usuario se acaba de registrar), pero
      // si entró dos veces al onboarding puede existir: POST y, si ya está, PUT.
      try {
        await api.post<CompanyProfile>("/companies/me/profile", payload, token);
      } catch {
        await api.put<CompanyProfile>("/companies/me/profile", payload, token);
      }
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos guardar tus datos. Probá de nuevo."));
      return false;
    }
  }

  // Termina el onboarding sin forzar la publicación de un turno — antes
  // mandaba directo a /shifts/new ("Publicar mi primer turno"), empujando a
  // publicar sin pensar si hace falta (y gastar un turno del plan free sólo
  // por curiosidad). El panel (/shifts) ya tiene "+ Publicar"/"+ Evento" bien
  // visibles para cuando el comercio decida que sí lo necesita.
  async function finish() {
    if (latitude === null || longitude === null) return;
    setSaving(true);
    if (await save(true)) router.replace("/shifts");
    else setSaving(false);
  }

  async function skipLocation() {
    setSkipping(true);
    if (await save(false)) router.replace("/shifts");
    else setSkipping(false);
  }

  // Salida completa del onboarding desde el paso 1, sin cargar nada todavía
  // (Julieta: "tenés que poder omitir el paso del onboarding si querés").
  // Guarda un nombre placeholder editable ("Mi comercio") en vez de dejar el
  // perfil sin nombre — evita reintroducir el bug que el onboarding en sí
  // había arreglado (candidatos viendo "Un comercio cerca tuyo" en vez de un
  // nombre real, ver docstring del archivo).
  async function skipAll() {
    setSkippingAll(true);
    if (await save(false, name.trim() || "Mi comercio")) router.replace("/shifts");
    else setSkippingAll(false);
  }

  return (
    <Shell>
      <StepDots active={step === "nombre" ? 0 : 1} total={2} />

      {step === "nombre" ? (
        <section className="mt-8 flex flex-1 flex-col">
          {/* "El gesto previo a empezar" (ART_DIRECTION.md §10.4) — mismo
              saludo que ve el trabajador en su primer paso. */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-structure)]">
            <WelcomeIllustration size={32} color="#f94e1b" />
          </div>
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            ¿Cómo se llama tu comercio?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
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

          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <TextField
              label="Nombre del comercio"
              value={name}
              onChange={setName}
              placeholder="Ej: Bar El Patio"
              maxLength={255}
            />
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Button fullWidth disabled={!name.trim()} onClick={() => setStep("ubicacion")}>
              Continuar
            </Button>
            <button
              type="button"
              disabled={skippingAll}
              onClick={skipAll}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/50 transition active:scale-[0.98] disabled:opacity-60"
            >
              {skippingAll ? "Guardando…" : "Omitir por ahora"}
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            ¿Dónde está?
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">
            Los turnos que publiques van a mostrar esta dirección, y les ordena
            la cercanía a los trabajadores.
          </p>

          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
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
            // Mismo criterio que el paso de zona del trabajador: celeste de
            // confianza, no naranja de acción.
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink/70">
              <MapPinIcon size={16} className="text-cielo-text" />
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
              Terminar
            </Button>
            <button
              type="button"
              disabled={skipping}
              onClick={skipLocation}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/50 transition active:scale-[0.98] disabled:opacity-60"
            >
              {skipping ? "Guardando…" : "Cargar la ubicación después"}
            </button>
            <button
              type="button"
              onClick={() => setStep("nombre")}
              className="min-h-[48px] w-full rounded-[var(--radius-btn)] font-semibold text-ink/35 transition active:scale-[0.98]"
            >
              Volver
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
