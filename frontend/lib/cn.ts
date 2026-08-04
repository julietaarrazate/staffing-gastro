/** Une clases condicionales (filtra falsy). Liviano, sin dependencias. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Estilo compartido de `<input>` en las pantallas de auth (recuperar,
 * restablecer, verificar-email) — antes duplicado literal en las 3. */
export const AUTH_INPUT_CLASS =
  "rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-orange-100";
