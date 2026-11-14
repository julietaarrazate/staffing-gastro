import { api } from "@/lib/api";
import type { WorkerProfile } from "@/lib/types";

/** Mail de la cuenta invitada del trabajador (`GUEST_ACCOUNTS` en
 *  `backend/app/modules/identity/application/services.py`). Se decide por la
 *  cuenta y no por la URL: una cuenta real nunca tiene que perder su perfil.
 *  `lib/worker-profile.test.ts` verifica que siga igual al del backend. */
export const GUEST_WORKER_EMAIL = "invitado.trabajador@oido.beta";
/** Ídem, el comercio invitado. */
export const GUEST_EMPLOYER_EMAIL = "invitado.comercio@oido.beta";

/**
 * Campos editables del perfil del trabajador, tal como los espera
 * `PUT/POST /workers/me/profile` (`WorkerProfileInput` del backend).
 *
 * Ojo con esto: **el endpoint reemplaza, no parchea**. Todos los campos del
 * schema tienen default, así que un PUT con sólo `photo_url` no actualiza la
 * foto — borra skills, bio, ciudad, CV y disponibilidad. Cualquier pantalla
 * que guarde una parte del perfil tiene que mandar el resto igual.
 */
export interface WorkerProfileInput {
  photo_url: string | null;
  birth_date: string | null;
  city: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  skills: WorkerProfile["skills"];
  years_experience: number;
  languages: string[];
  certifications: string[];
  cv_url: string | null;
  cv_filename: string | null;
  is_available: boolean;
}

/**
 * Arma el payload completo a partir del perfil ya cargado, con los cambios
 * encima.
 *
 * Existe para que el "reemplaza, no parchea" de arriba deje de ser una trampa:
 * el día que se agregue un campo editable, un payload armado a mano que se
 * olvide de sumarlo lo borraría en silencio cada vez que guarde. Acá se
 * agrega una vez. Para guardar una parte del perfil desde una pantalla, usar
 * `saveProfilePart` (que además lee el perfil fresco del servidor).
 */
export function toWorkerProfileInput(
  profile: WorkerProfile,
  changes: Partial<WorkerProfileInput> = {}
): WorkerProfileInput {
  return {
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
    cv_filename: profile.cv_filename,
    is_available: profile.is_available,
    ...changes,
  };
}

/**
 * Guarda UNA parte del perfil sin pisar el resto.
 *
 * Lee el perfil del servidor justo antes de escribir y manda el perfil
 * completo con `changes` encima. No se usa la copia que la pantalla cargó al
 * montarse: puede estar vieja (la persona guardó otra cosa en otra pestaña o
 * dispositivo, o la pantalla se pintó desde caché y todavía se está
 * actualizando) y mandarla deshace esos cambios en silencio.
 *
 * Devuelve lo que respondió el servidor: la pantalla se queda con eso.
 *
 * Límite conocido: entre el GET y el PUT hay una ventana de milisegundos en
 * la que otro guardado se puede perder. El arreglo de fondo es un guardado
 * parcial en el backend (ver `docs/historial/2026-11-12-perfil-guardado-parcial.md`).
 */
export async function saveProfilePart(
  token: string | null,
  changes: Partial<WorkerProfileInput>
): Promise<WorkerProfile> {
  const current = await api.get<WorkerProfile>("/workers/me/profile", token);
  return api.put<WorkerProfile>(
    "/workers/me/profile",
    toWorkerProfileInput(current, changes),
    token
  );
}
