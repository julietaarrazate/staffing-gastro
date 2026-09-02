"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import MapAddressPicker, { MapAddressSelection } from "@/components/map/MapAddressPicker";
import ImageUpload from "@/components/ImageUpload";
import { Button, ErrorBanner, Skeleton, TextField } from "@/components/ui";
import { MapPinIcon } from "@/components/icons";

export default function CompanyProfileForm() {
  const { token } = useAuth();
  const [exists, setExists] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // El mapa (ADR-0006) es el método principal de ubicación; el selector
  // manual por provincia/localidad queda como fallback (geocoder caído, o el
  // comercio prefiere cargar a mano).
  const [useManualPicker, setUseManualPicker] = useState(false);
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
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((p) => {
        setExists(true);
        setName(p.name);
        setLogoUrl(p.logo_url);
        setAddress(p.address ?? "");
        setCity(p.city ?? "");
        setLatitude(p.latitude ?? null);
        setLongitude(p.longitude ?? null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = {
      name,
      logo_url: logoUrl,
      address: address || null,
      city: city || null,
      latitude,
      longitude,
    };
    setSubmitting(true);
    try {
      if (exists) {
        await api.put<CompanyProfile>("/companies/me/profile", payload, token);
      } else {
        await api.post<CompanyProfile>("/companies/me/profile", payload, token);
      }
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
        <Skeleton className="h-20 w-20 rounded-xl" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorBanner message={loadError} onRetry={load} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ImageUpload value={logoUrl} onChange={setLogoUrl} fallbackLabel={name || "C"} shape="square" />

      <TextField
        label="Nombre del comercio"
        value={name}
        onChange={setName}
        required
        maxLength={255}
      />
      <div>
        {/* No es un `<label>`: no hay un único control al que asociar (el
            selector de ubicación de abajo es un widget compuesto, mapa o
            cascada de provincia/localidad — jsx-a11y/label-has-associated-
            control, TECH_DEBT.md F4). */}
        <p className="flex items-center gap-2 text-sm font-medium text-ink/70">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary-text">
            <MapPinIcon size={13} />
          </span>
          Ubicación del comercio
        </p>
        <div className="mt-2">
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
                className="w-fit text-xs font-medium text-ink/40 underline decoration-line underline-offset-2 hover:text-ink/60"
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
          <p className="mt-2 text-sm font-medium text-ink/70">
            Ubicación: <span className="text-primary-text">{city}</span>
          </p>
        )}
      </div>

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
