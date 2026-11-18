/**
 * Acceso a `sessionStorage` que nunca rompe la pantalla: modo privado,
 * almacenamiento bloqueado o cuota llena lanzan al leer o escribir, y en
 * cualquiera de esos casos la pantalla tiene que funcionar igual, sólo que sin
 * recordar. Todo lo que se guarda para sobrevivir a una recarga (borrador de
 * «Publicar», pasos de «Bienvenida») pasa por acá.
 */

/** Prefijo común: cerrar sesión borra todo lo que empiece con esto. */
export const PREFIJO_BORRADOR = "staffya:borrador:";

export function leerSesion<T>(clave: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(clave);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function guardarSesion(clave: string, valor: unknown): void {
  try {
    window.sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento: no se recuerda, y listo.
  }
}

export function borrarSesion(clave: string): void {
  try {
    window.sessionStorage.removeItem(clave);
  } catch {
    // No hay nada que borrar.
  }
}

/** Borra todos los borradores de la pestaña (al cerrar sesión). */
export function borrarBorradores(): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(PREFIJO_BORRADOR)) claves.push(k);
    }
    claves.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // No hay nada que borrar.
  }
}
