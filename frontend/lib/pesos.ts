/**
 * Montos en pesos enteros para los campos de pago (publicar turno y evento).
 *
 * El campo era `type="number"` y el navegador descartaba la coma:
 * «15000,50» quedaba «1500050» y el turno se publicaba con $1.500.050, sin
 * aviso (hallazgo grave de la prueba en la app, 2026-11-14). Diseño acordado
 * con Julieta: el monto es en pesos enteros, el punto es separador de miles,
 * la coma es decimal y se redondea al peso.
 *
 * El estado de los formularios guarda siempre el monto canónico: dígitos sin
 * separadores («15001») o «» si no hay un monto válido. Así `Number(valor)`
 * sigue funcionando en todos lados y el backend recibe un entero.
 */

const FORMATO = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** El backend guarda `Numeric(12, 2)`: 10 cifras enteras como mucho. Más que
 *  eso no es un pago, es un error de tipeo (y el servidor lo rechazaría). */
const MAX_CIFRAS = 10;

/**
 * Lee lo que escribió la persona y devuelve el monto canónico, o `null` si el
 * texto no es un monto (entonces el formulario no deja seguir).
 *
 * - «15000» → «15000»; «15.000» → «15000»; «$ 15.000» → «15000»
 * - «15000,50» → «15001»; «15.000,49» → «15000» (al peso, la mitad sube)
 * - «» → «» (vacío no es un error: todavía no escribió nada)
 * - más de 10 cifras enteras → `null` (el backend no lo guarda)
 * - «15.00», «1.5», «1,000,000», «15a» → `null`: un punto que no separa un
 *   grupo de tres cifras no es de miles, y adivinar ahí es justo el error que
 *   se está arreglando.
 */
export function leerPesos(texto: string): string | null {
  const limpio = texto.replace(/[\s$]/g, "");
  if (limpio === "") return "";
  const m = /^(\d{1,3}(?:\.\d{3})+|\d*)(?:,(\d*))?$/.exec(limpio);
  if (!m) return null;
  const entero = m[1].replace(/\./g, "");
  const decimales = m[2] ?? "";
  if (entero === "" && decimales === "") return null; // «,» suelta
  // Al peso: sólo importa la primera cifra decimal (x,5 o más sube). Con
  // strings y BigInt para no perder precisión ni redondear de más con floats.
  const sube = decimales !== "" && Number(decimales[0]) >= 5;
  const pesos = BigInt(entero === "" ? "0" : entero) + (sube ? BigInt(1) : BigInt(0));
  const canonico = pesos.toString();
  return canonico.length > MAX_CIFRAS ? null : canonico;
}

/** Monto canónico formateado para mostrar en el campo: «15001» → «15.001». */
export function formatearPesos(canonico: string): string {
  if (!/^\d+$/.test(canonico)) return canonico;
  return FORMATO.format(BigInt(canonico));
}

/**
 * Monto que viene de la API, de la IA o de un borrador guardado («15000.00»,
 * 15000, «15000») al formato canónico del formulario. Estos sí usan punto
 * decimal: no los escribió una persona.
 */
export function pesosDesdeApi(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n >= 10 ** MAX_CIFRAS) return "";
  return String(Math.round(n));
}
