import type { WorkerProfile } from "@/lib/types";

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
 * hay dos lugares que guardan el perfil (el formulario completo y el avatar
 * del hero, que sube la foto sola), y sin esto cada uno arma su propio payload
 * a mano. El día que se agregue un campo editable, el que se olvide de sumarlo
 * lo borraría en silencio cada vez que guarde. Acá se agrega una vez.
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
