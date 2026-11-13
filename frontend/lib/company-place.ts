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
 * o sin red, `place` queda en `null` y el comercio elige la zona a mano.
 */
export function useCompanyPlace(token: string | null): { place: CompanyPlace | null; loaded: boolean } {
  const [place, setPlace] = useState<CompanyPlace | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((company) => {
        if (!cancelled) setPlace(companyPlaceFromProfile(company));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { place, loaded };
}
