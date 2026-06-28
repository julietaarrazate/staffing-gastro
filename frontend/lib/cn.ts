/** Une clases condicionales (filtra falsy). Liviano, sin dependencias. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
