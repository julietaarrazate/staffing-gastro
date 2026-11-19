"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";
import LocationPicker, { LocationSelection } from "@/components/LocationPicker";
import type { MapAddressSelection } from "@/components/map/MapAddressPicker";
import ImageUpload from "@/components/ImageUpload";
import CoverPhotoUpload from "@/components/CoverPhotoUpload";
import { Button, ErrorBanner, Skeleton, TextField } from "@/components/ui";
import { MapPinIcon } from "@/components/icons";
import IconChip from "@/components/ui/IconChip";
import { LIMITES } from "@/lib/limites";
import { saveCompanyProfilePart, type CompanyProfileChanges } from "@/lib/company-profile";

// maplibre pesa ~286 KB comprimidos: se carga recién cuando se muestra el
// mapa, no con la página (medido 2026-10-22, ver historial).
const MapAddressPicker = dynamic(() => import("@/components/map/MapAddressPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-3">
      <div className="h-12 w-full animate-pulse rounded-[var(--radius-input)] bg-surface" />
      <div className="h-64 w-full animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  ),
});

/** Lo que el formulario edita, normalizado para compararlo con lo cargado. */
type CompanyFields = Required<CompanyProfileChanges>;

function fieldsOf(p: CompanyProfile): CompanyFields {
  return {
    name: p.name,
    logo_url: p.logo_url ?? null,
    cover_photo_url: p.cover_photo_url ?? null,
    address: p.address || null,
    city: p.city || null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  };
}

/**
 * Sólo lo que la persona tocó respecto de lo que cargó el formulario (ESC-02,
 * 2026-11-19): lo demás lo pone `saveCompanyProfilePart` con lo que tiene el
 * servidor, así un formulario abierto desde antes no revierte, por ejemplo, un
 * logo cambiado en otro lado. La ubicación va junta (dirección, ciudad y
 * coordenadas cambian en un mismo gesto del selector).
 */
export function changedCompanyFields(
  now: CompanyFields,
  loaded: CompanyFields
): CompanyProfileChanges {
  const out: CompanyProfileChanges = {};
  if (now.name !== loaded.name) out.name = now.name;
  if (now.logo_url !== loaded.logo_url) out.logo_url = now.logo_url;
  if (now.cover_photo_url !== loaded.cover_photo_url) out.cover_photo_url = now.cover_photo_url;
  if (
    now.address !== loaded.address ||
    now.city !== loaded.city ||
    now.latitude !== loaded.latitude ||
    now.longitude !== loaded.longitude
  ) {
    out.address = now.address;
    out.city = now.city;
    out.latitude = now.latitude;
    out.longitude = now.longitude;
  }
  return out;
}

export default function CompanyProfileForm() {
  const { token } = useAuth();
  const [exists, setExists] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // El mapa (ADR-0006) es el método principal de ubicación; el selector
  // manual por provincia/localidad queda como fallback (geocoder caído, o el
  // comercio prefiere cargar a mano).
  const [loadedFields, setLoadedFields] = useState<CompanyFields | null>(null);
  const [useManualPicker, setUseManualPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Llena el formulario y lo «cargado» con lo que tiene el servidor: al abrir y
  // después de guardar, así la pantalla muestra lo que quedó y el próximo
  // guardado compara contra esa verdad.
  const applyProfile = useCallback((p: CompanyProfile) => {
    setName(p.name);
    setLogoUrl(p.logo_url ?? null);
    setCoverUrl(p.cover_photo_url ?? null);
    setAddress(p.address ?? "");
    setCity(p.city ?? "");
    setLatitude(p.latitude ?? null);
    setLongitude(p.longitude ?? null);
    setLoadedFields(fieldsOf(p));
  }, []);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((p) => {
        setExists(true);
        applyProfile(p);
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
  }, [token, applyProfile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    // Rubro, descripción, capacidad y horarios no se editan acá y no se mandan:
    // el backend trata lo que no vino como «no tocar» (actualización parcial).
    const current: CompanyFields = {
      name,
      logo_url: logoUrl ?? null,
      cover_photo_url: coverUrl,
      address: address || null,
      city: city || null,
      latitude,
      longitude,
    };
    setSubmitting(true);
    try {
      if (exists) {
        applyProfile(
          await saveCompanyProfilePart(
            token,
            loadedFields ? changedCompanyFields(current, loadedFields) : current
          )
        );
      } else {
        // Todavía no hay perfil: no hay nada que preservar.
        applyProfile(await api.post<CompanyProfile>("/companies/me/profile", current, token));
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
        maxLength={LIMITES.nombreComercio}
      />
      <CoverPhotoUpload value={coverUrl} onChange={setCoverUrl} />
      <div>
        {/* No es un `<label>`: no hay un único control al que asociar (el
            selector de ubicación de abajo es un widget compuesto, mapa o
            cascada de provincia/localidad — jsx-a11y/label-has-associated-
            control, TECH_DEBT.md F4). */}
        <p className="flex items-center gap-2 text-sm font-medium text-ink/70">
          <IconChip tone="trust" size="xs">
            <MapPinIcon size={13} />
          </IconChip>
          Ubicación del comercio
        </p>
        <div className="mt-2">
          {useManualPicker ? (
            <div className="flex flex-col gap-2">
              <LocationPicker
                initialCity={city}
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
