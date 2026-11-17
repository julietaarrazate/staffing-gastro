import { LIMITES } from "@/lib/limites";

/** Por qué el botón "Crear cuenta" todavía no se puede apretar (U041). Mismo
 * patrón que `motivoBloqueo` de "Publicar turno": una frase que dice qué falta,
 * o `null` si se puede seguir. Las reglas del nombre y de la clave espejan las
 * de `RegisterRequest` (backend/app/modules/identity/api/schemas.py). */
export function motivoBloqueoRegistro(v: {
  nombre: string;
  email: string;
  clave: string;
  terminos: boolean;
  falta_verificacion: boolean;
}): string | null {
  if (v.nombre.trim() === "") return "Escribí tu nombre para seguir.";
  if (v.email.trim() === "") return "Escribí tu email para seguir.";
  if (v.clave.length < LIMITES.contrasenaMin)
    return `La contraseña necesita al menos ${LIMITES.contrasenaMin} caracteres.`;
  if (new Set(v.clave).size === 1)
    return "La contraseña no puede ser un solo carácter repetido.";
  if (!v.terminos) return "Aceptá los términos y la política de privacidad para seguir.";
  if (v.falta_verificacion) return "Completá la verificación de seguridad para seguir.";
  return null;
}
