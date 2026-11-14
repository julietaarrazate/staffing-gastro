/**
 * Límites de los campos de texto y número, los mismos que valida el servidor
 * (`api/schemas.py` de cada módulo del backend, `Field(max_length=…, ge=…, le=…)`).
 * Si cambia un esquema, cambia acá: así un campo no deja escribir (o enviar)
 * lo que el servidor después rechaza con un 422.
 */
export const LIMITES = {
  /** identity: `RegisterRequest.full_name`, `UpdateMeRequest.full_name`. */
  nombre: 255,
  /** identity: `RegisterRequest.password` (mínimo 8). */
  contrasenaMin: 8,
  contrasenaMax: 128,
  /** chat: `SendMessageRequest.body`. */
  mensajeChat: 2000,
  /** assistant: `text` del pedido en lenguaje natural. */
  pedidoAsistente: 500,
  /** shift: `ShiftInput.dress_code` y `EventInput.dress_code`. */
  codigoVestimenta: 255,
  /** shift: `EventInput.name`. */
  nombreEvento: 200,
  /** shift: `EventRoleInput.count` (entre 1 y 50 personas por rol). */
  cantidadRolMin: 1,
  cantidadRolMax: 50,
  /** worker: `WorkerProfileInput.bio`. */
  bio: 1000,
  /** worker: `WorkerProfileInput.years_experience` (entre 0 y 80). */
  aniosExperienciaMin: 0,
  aniosExperienciaMax: 80,
  /** company: `CompanyProfileInput.name`. */
  nombreComercio: 255,
} as const;

/** Rango de los campos numéricos por nombre en la API: lo que `parseErrorDetail`
 * usa para decir «Entre 1 y 50» (el 422 sólo trae la cota que se pasó). */
export const RANGOS_NUMERICOS: Record<string, { min?: number; max?: number }> = {
  count: { min: LIMITES.cantidadRolMin, max: LIMITES.cantidadRolMax },
  years_experience: { min: LIMITES.aniosExperienciaMin, max: LIMITES.aniosExperienciaMax },
  rating: { min: 1, max: 5 },
  pay_amount: { min: 0 },
};
