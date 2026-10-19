/**
 * Ícono sobre un chip de color suave: el recurso de las estadísticas del
 * perfil ("Turnos" en manteca, "Cancelaciones" en petróleo, "Años exp." en
 * celeste) llevado al resto de la app.
 *
 * Existe porque Julieta lo marcó el 2026-09-27: el chip de color sólo estaba
 * en ese sector del perfil, y en las demás pantallas el mismo tipo de ícono
 * (una fila de menú, un dato de un turno) iba en gris sobre gris. La receta
 * vivía copiada a mano en cada lugar; acá queda una sola.
 *
 * El tono dice QUÉ ES el dato, no decora, y se repite igual en toda la app:
 *
 * - `cielo`: tiempo (cuándo, horario) y comunicación (soporte, avisos).
 * - `trust` (petróleo): lugar y fiabilidad (dónde, verificación, cancelaciones).
 * - `manteca`: personas y trabajo (puesto, turnos, cuántos).
 * - `secondary` (verde bosque): plata (pago, plan, lo ganado).
 * - `danger`: sólo favoritos (el corazón), nunca un error disfrazado.
 * - `primary` (ámbar): lo reservado al acento de la pantalla. Usarlo poco:
 *   la regla de un solo acento ámbar por pantalla sigue valiendo.
 * - `neutral`: acciones que no son contenido (cerrar sesión).
 *
 * Los botones de control (atrás, cerrar, flechas) NO usan esto: son
 * herramientas, no datos, y con color competirían con el contenido.
 *
 * Todos los pares tint/text están redefinidos para oscuro en `globals.css`,
 * así que el chip conserva el color en los dos temas (el problema que tuvo la
 * tile del medio en septiembre: un "neutro" hecho de `bg-surface` se muere
 * sobre una tarjeta oscura).
 */

export type IconChipTone =
  | "cielo"
  | "trust"
  | "manteca"
  | "secondary"
  | "danger"
  | "primary"
  | "neutral";

const TONES: Record<IconChipTone, string> = {
  cielo: "bg-cielo-tint text-cielo-text",
  trust: "bg-trust-tint text-trust-text",
  manteca: "bg-manteca-tint text-manteca-text",
  secondary: "bg-secondary-tint text-secondary-text",
  danger: "bg-danger-tint text-danger-text",
  primary: "bg-primary-tint text-primary-text",
  neutral: "bg-surface text-ink/60",
};

const SIZES = {
  xs: "h-6 w-6 rounded-lg",
  sm: "h-8 w-8 rounded-xl",
  md: "h-9 w-9 rounded-xl",
  lg: "h-10 w-10 rounded-xl",
} as const;

export default function IconChip({
  tone,
  size = "md",
  className = "",
  children,
}: {
  tone: IconChipTone;
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
