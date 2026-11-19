import { api } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";

/** Campos del perfil del comercio que edita `CompanyProfileForm`. */
export interface CompanyProfileChanges {
  name?: string;
  logo_url?: string | null;
  cover_photo_url?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Guarda UNA parte del perfil del comercio sin pisar el resto.
 *
 * El `PUT /companies/me/profile` escribe siempre nombre, logo, dirección,
 * ciudad y coordenadas (la portada, rubro, descripción, capacidad y horarios
 * sólo si vienen). Mandar la copia que el formulario cargó al abrirse pisa lo
 * que se guardó desde otra pestaña o pantalla. Acá se lee el perfil del
 * servidor justo antes de escribir y se manda eso con `changes` encima; la
 * portada sólo va si cambió. Mismo patrón que `saveProfilePart` del
 * trabajador; queda la ventana de milisegundos entre leer y escribir.
 */
export async function saveCompanyProfilePart(
  token: string | null,
  changes: CompanyProfileChanges
): Promise<CompanyProfile> {
  const current = await api.get<CompanyProfile>("/companies/me/profile", token);
  return api.put<CompanyProfile>(
    "/companies/me/profile",
    {
      name: current.name,
      logo_url: current.logo_url,
      address: current.address,
      city: current.city,
      latitude: current.latitude,
      longitude: current.longitude,
      ...changes,
    },
    token
  );
}
