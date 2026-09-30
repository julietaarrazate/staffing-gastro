/**
 * Versión vigente de /terminos y /privacidad.
 *
 * El backend guarda cuál aceptó cada persona al crear su cuenta
 * (`LEGAL_TERMS_VERSION` en `backend/app/modules/identity/domain/value_objects.py`).
 * Las dos tienen que decir lo mismo: si cambiás el texto de cualquiera de las
 * páginas, subí la versión acá y allá en el mismo cambio. Si no, el registro
 * diría que alguien aceptó una versión que no fue la que leyó.
 */
export const LEGAL_TERMS_VERSION = "2026-09-29";

export const LEGAL_LAST_UPDATED = "Última actualización: septiembre 2026";

/**
 * Responsable de la base de datos (Ley 25.326, art. 6) y prestadora del
 * servicio. Oído no es una sociedad: responde una persona humana. Un solo
 * lugar para las dos páginas, así no se contradicen.
 */
export const LEGAL_OWNER = {
  name: "María Julieta Arrazate",
  cuil: "27-36316081-1",
  address: "Av. General Las Heras 3515, Ciudad Autónoma de Buenos Aires",
  email: "hola@oido.com.ar",
};
