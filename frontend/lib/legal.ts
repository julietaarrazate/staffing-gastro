/**
 * Versión vigente de /terminos y /privacidad.
 *
 * El backend guarda cuál aceptó cada persona al crear su cuenta
 * (`LEGAL_TERMS_VERSION` en `backend/app/modules/identity/domain/value_objects.py`).
 * Las dos tienen que decir lo mismo: si cambiás el texto de cualquiera de las
 * páginas, subí la versión acá y allá en el mismo cambio. Si no, el registro
 * diría que alguien aceptó una versión que no fue la que leyó.
 */
export const LEGAL_TERMS_VERSION = "2026-09";

export const LEGAL_LAST_UPDATED = "Última actualización: septiembre 2026";
