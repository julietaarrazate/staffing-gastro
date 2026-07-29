"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { getCached, setCached } from "@/lib/screen-cache";
import {
  distanceOf,
  getStoredLocation,
  originFor,
  sortByDistance,
  type CurrentLocation,
} from "@/lib/current-location";
import LocationBar from "@/components/worker/LocationBar";
import { Avatar, CardSkeleton, CardSkeletons, EmptyState, useToast } from "@/components/ui";
import SwipeDeck from "@/components/worker/SwipeDeck";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { CalendarIcon } from "@/components/icons";

/** Lo que se conserva del feed entre visitas a la pestaña (ver screen-cache). */
interface CachedFeed {
  shifts: Shift[];
  profile: WorkerProfile | null;
}
const FEED_CACHE_KEY = "worker-feed";

export default function WorkerHomePage() {
  const { token, user } = useAuth();
  const { requestOptIn } = usePushPrompt();
  const toast = useToast();
  // Stale-while-revalidate (lib/screen-cache.ts): si el trabajador ya estuvo
  // en el feed en esta sesión, la pantalla pinta al instante lo último que vio
  // y refresca por detrás, en vez de mostrar el esqueleto entero cada vez que
  // vuelve a la pestaña.
  const cached = getCached<CachedFeed>(FEED_CACHE_KEY);
  const [shifts, setShifts] = useState<Shift[]>(cached?.shifts ?? []);
  const [profile, setProfile] = useState<WorkerProfile | null>(cached?.profile ?? null);
  const [available, setAvailable] = useState(cached?.profile?.is_available ?? true);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  // Grilla de escritorio (md+, sin swipe): turno con una decisión en vuelo.
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // "Estoy acá ahora": si el trabajador compartió dónde está, el feed se
  // ordena desde ese punto y no desde la zona fija de su perfil. Dura lo que
  // dura la pestaña y NO pisa el perfil (ver lib/current-location.ts).
  const [here, setHere] = useState<CurrentLocation | null>(null);
  useEffect(() => setHere(getStoredLocation()), []);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(async () => {
    if (!token) return;
    // Sólo bloqueamos con esqueleto en la primera carga real; si ya hay algo
    // cacheado, el refresco es silencioso.
    if (getCached<CachedFeed>(FEED_CACHE_KEY) === undefined) setLoading(true);
    setError(null);
    try {
      const [feed, prof, applied] = await Promise.all([
        api.get<Shift[]>("/shifts/feed", token),
        api.get<WorkerProfile>("/workers/me/profile", token).catch(() => null),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      const appliedIds = new Set(applied.map((a) => a.shift_id));
      const visible = feed.filter((s) => !appliedIds.has(s.id));
      setShifts(visible);
      if (prof) {
        setProfile(prof);
        setAvailable(prof.is_available);
      }
      setCached<CachedFeed>(FEED_CACHE_KEY, { shifts: visible, profile: prof });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el feed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAvailable() {
    if (!token || !profile) return;
    const next = !available;
    setAvailable(next); // optimista
    try {
      await api.put<WorkerProfile>(
        "/workers/me/profile",
        {
          photo_url: profile.photo_url,
          birth_date: profile.birth_date,
          city: profile.city,
          bio: profile.bio,
          latitude: profile.latitude,
          longitude: profile.longitude,
          skills: profile.skills,
          years_experience: profile.years_experience,
          languages: profile.languages,
          certifications: profile.certifications,
          cv_url: profile.cv_url,
          is_available: next,
        },
        token
      );
      toast(next ? "Estás disponible" : "Te marcaste como no disponible");
    } catch {
      setAvailable(!next); // revertir
      toast("No se pudo actualizar tu disponibilidad", "error");
    }
  }

  /** Saca un turno ya decidido del caché del feed, para que al volver a la
   *  pestaña no reaparezca una carta que el trabajador ya despachó (el mazo
   *  visible no se toca: lo maneja SwipeDeck con su propio estado). */
  function dropFromCache(shiftId: string) {
    const current = getCached<CachedFeed>(FEED_CACHE_KEY);
    if (!current) return;
    setCached<CachedFeed>(FEED_CACHE_KEY, {
      ...current,
      shifts: current.shifts.filter((s) => s.id !== shiftId),
    });
  }

  async function onDecide(shift: Shift, decision: "like" | "pass"): Promise<boolean> {
    // "pass" es un descarte local: no hay red de por medio, así que siempre
    // se considera procesado.
    if (decision === "pass" || !token) {
      if (decision === "pass") dropFromCache(shift.id);
      return true;
    }
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): si la carta vuelve al
      // mazo por un error de red y el trabajador vuelve a swipear a la
      // derecha, es el MISMO intento — se reusa la key hasta que postularse
      // termine bien.
      await api.post(
        `/applications/shifts/${shift.id}`,
        undefined,
        token,
        undefined,
        keyFor(shift.id)
      );
      clearIdempotencyKey(shift.id);
      dropFromCache(shift.id);
      toast("¡Te postulaste! El comercio ya te puede ver");
      // Primera acción significativa del flujo del trabajador: acá, y no al
      // aterrizar en la app, es cuando tiene sentido preguntar si quiere
      // enterarse por push cuando el comercio responda (ver docs/ACCESO_MODERNO.md).
      requestOptIn();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Ya estaba postulado: no es un error real, se trata como descarte
        // (la carta no vuelve).
        clearIdempotencyKey(shift.id);
        dropFromCache(shift.id);
        toast("Ya te habías postulado a este turno");
        return true;
      }
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
      return false;
    }
  }

  /** Decidir desde la grilla de escritorio: mismo `onDecide` de arriba, pero
   *  sin el mazo local de SwipeDeck que en mobile saca la carta de encima —
   *  acá hay que sacar el turno de `shifts` a mano para que desaparezca de
   *  la grilla apenas se resuelve. */
  async function handleGridDecide(shift: Shift, decision: "like" | "pass") {
    if (decidingId !== null) return;
    setDecidingId(shift.id);
    const ok = await onDecide(shift, decision);
    if (ok) setShifts((prev) => prev.filter((s) => s.id !== shift.id));
    setDecidingId(null);
  }

  const firstName = user?.full_name?.split(" ")[0];

  const origin = originFor(here, profile);
  const visibleShifts = sortByDistance(shifts, origin);

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-5rem)] max-w-md flex-col px-4 pb-3 pt-3 md:h-[calc(100dvh-4rem)] md:max-w-5xl">
      {/* Header: saludo + disponibilidad */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.photo_url} name={user?.full_name ?? "Vos"} size="lg" />
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight text-ink">
              {firstName ? `Hola, ${firstName}` : "Hola"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAvailable}
          className="flex flex-col items-center gap-1"
          aria-label="Cambiar disponibilidad"
        >
          <span
            className={`relative h-7 w-12 rounded-full transition-colors ${
              available ? "bg-success" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                available ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
          <span className={`text-[11px] font-semibold ${available ? "text-success-text" : "text-ink/40"}`}>
            {available ? "Disponible" : "No disp."}
          </span>
        </button>
      </header>

      <LocationBar
        current={here}
        profileCity={profile?.city ?? null}
        onChange={setHere}
      />

      {/* Deck */}
      <div className="min-h-0 flex-1 md:overflow-y-auto">
        {loading ? (
          <>
            <div className="h-full md:hidden">
              <CardSkeleton />
            </div>
            <div className="hidden md:block">
              <CardSkeletons count={6} />
            </div>
          </>
        ) : error ? (
          <EmptyState
            icon={<CalendarIcon size={30} />}
            title="No se pudo cargar"
            subtitle={error}
            primaryAction={{ label: "Reintentar", onClick: load }}
          />
        ) : (
          <>
            {/* Mobile: mazo tipo Tinder, se decide con swipe. */}
            <div className="h-full md:hidden">
              <SwipeDeck
                shifts={visibleShifts}
                onDecide={onDecide}
                renderCard={(shift) => (
                  <OpportunityCard shift={shift} distanceKm={distanceOf(shift, origin)} />
                )}
                empty={
                  <EmptyState
                    icon={<CalendarIcon size={30} />}
                    title="No hay más turnos cerca"
                    subtitle="Ya viste todas las oportunidades del momento. Aparecen en tiempo real: volvé en un rato."
                    primaryAction={{ label: "Actualizar", onClick: load }}
                  />
                }
              />
            </div>

            {/* Desktop (md+): el gesto de swipe no existe con mouse, así que
                se ven todas las oportunidades a la vez en una grilla, con
                Postularme/No gracias como botones directos en cada tarjeta
                (antes el mazo se estiraba solo, centrado en una pantalla
                vacía — ver docs/STATUS.md, pedido de Julieta 2026-07-29). */}
            <div className="hidden md:block">
              {visibleShifts.length === 0 ? (
                <EmptyState
                  icon={<CalendarIcon size={30} />}
                  title="No hay más turnos cerca"
                  subtitle="Ya viste todas las oportunidades del momento. Aparecen en tiempo real: volvé en un rato."
                  primaryAction={{ label: "Actualizar", onClick: load }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-5 pb-6 lg:grid-cols-3">
                  {visibleShifts.map((shift) => (
                    <div key={shift.id} className="h-[480px]">
                      <OpportunityCard
                        shift={shift}
                        distanceKm={distanceOf(shift, origin)}
                        applying={decidingId === shift.id}
                        onApply={() => handleGridDecide(shift, "like")}
                        onPass={() => handleGridDecide(shift, "pass")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
