"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";

/**
 * El local del comercio como zona de publicación. Lo usan el asistente de
 * turno (`/shifts/new`) y el formulario de evento (`/shifts/new-event`): los
 * dos arrancan en el local y dejan cambiarlo, para no pedir la zona en cada
 * publicación (auditoría de interfaz 2026-10-11, U04/B03).
 */
export type CompanyPlace = { label: string; city: string; latitude: number; longitude: number };

/** `null` si el local todavía no tiene coordenadas: sin ellas no hay zona. */
export function companyPlaceFromProfile(
  company: Pick<CompanyProfile, "name" | "address" | "city" | "latitude" | "longitude">
): CompanyPlace | null {
  if (company.latitude == null || company.longitude == null) return null;
  return {
    label: company.address || company.city || company.name,
    city: company.city ?? "",
    latitude: company.latitude,
    longitude: company.longitude,
  };
}

/**
 * Lee el perfil del comercio una vez por sesión de pantalla. `loaded` pasa a
 * true cuando terminó el pedido (con o sin local): sirve para no mostrar el
 * pedido de elegir zona mientras todavía se está buscando el local. Sin perfil
 * o sin red, `place` queda en `null` y `error` en true: el asistente y el
 * evento lo tratan como «sin local» (el comercio elige la zona a mano), pero
 * `/search` muestra el error con `retry`, porque ahí «sin local» no busca.
 */
export function useCompanyPlace(token: string | null): {
  place: CompanyPlace | null;
  loaded: boolean;
  /** true si el pedido falló: «no sé dónde está el local», distinto de «no tiene». */
  error: boolean;
  retry: () => void;
} {
  const [place, setPlace] = useState<CompanyPlace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setError(false);
    setLoaded(false);
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((company) => {
        if (!cancelled) setPlace(companyPlaceFromProfile(company));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  return { place, loaded, error, retry: () => setAttempt((n) => n + 1) };
}
