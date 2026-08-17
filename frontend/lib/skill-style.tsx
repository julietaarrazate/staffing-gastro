import type { ComponentType } from "react";
import { WorkerSkill } from "@/lib/types";
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  ChefHatIcon,
  CoffeeIcon,
  GlassIcon,
  RouteIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from "@/components/icons";

/**
 * Acento sobrio por rubro (DS v2 → paleta editorial cálida, 2026-07-29): sólo
 * tonos que conviven con el sistema crema/naranja/carbón. Antes esta tabla
 * tenía un arcoíris (rose/teal/emerald/lime) que rompía el lenguaje cálido —
 * el rosa del bartender y el teal del runner desentonaban sobre el crema. Ahora
 * se limita a naranja, ámbar (dorado), terracota (rojo cálido), verde bosque
 * (el mismo `success` de la paleta) y stone (neutro cálido); el ícono
 * diferencia el puesto por su FORMA, el color sólo aporta calidez. Se usa en
 * el chip del ícono sobre tarjetas blancas/foto y en el ícono del marcador del
 * mapa — nunca como banda de color a toda la tarjeta.
 */
export const SKILL_ACCENT: Record<
  WorkerSkill,
  { Icon: ComponentType<IconProps>; bg: string; fg: string }
> = {
  mozo: { Icon: UsersIcon, bg: "bg-orange-50", fg: "text-orange-700" },
  bartender: { Icon: GlassIcon, bg: "bg-red-50", fg: "text-red-700" },
  barista: { Icon: CoffeeIcon, bg: "bg-amber-50", fg: "text-amber-700" },
  runner: { Icon: RouteIcon, bg: "bg-stone-100", fg: "text-stone-600" },
  cocinero: { Icon: ChefHatIcon, bg: "bg-orange-50", fg: "text-orange-600" },
  cajero: { Icon: WalletIcon, bg: "bg-green-50", fg: "text-success-text" },
  recepcionista: { Icon: BellIcon, bg: "bg-amber-50", fg: "text-amber-800" },
  personal_eventos: { Icon: CalendarIcon, bg: "bg-green-50", fg: "text-success-text" },
  ayudante_cocina: { Icon: ChefHatIcon, bg: "bg-amber-50", fg: "text-amber-700" },
  personal_salon: { Icon: BuildingIcon, bg: "bg-stone-100", fg: "text-stone-700" },
};

/**
 * Gradiente SATURADO por rubro, para el banner de una tarjeta de turno cuando
 * el comercio no subió foto (`OpportunityCard`). Es el complemento oscuro de
 * `SKILL_ACCENT`, que arriba es deliberadamente pálido porque va detrás de un
 * ícono chico sobre superficie blanca; acá, en cambio, el color OCUPA el
 * banner y lleva texto blanco encima, así que necesita profundidad real.
 *
 * Por qué existe (Julieta, 2026-08-16): el banner sin foto arrancó siendo el
 * tinte pálido de `SKILL_ACCENT` a toda la tarjeta ("muy beige, plano"), pasó
 * a un único gradiente naranja de marca (mejor, pero "todas iguales"), y al
 * ver los 3 colores distintos que quedaron en la landing pidió traerlos
 * adentro. Sigue siendo un color por tarjeta —no un arcoíris dentro de una
 * misma tarjeta— y toda la escala vive en la paleta cálida de la marca
 * (naranja / terracota / ámbar / verde bosque / piedra), la misma familia que
 * `SKILL_ACCENT`: el rubro se lee por la FORMA del ícono, el gradiente sólo
 * evita que dos turnos seguidos se sientan la misma tarjeta repetida.
 */
export const SKILL_HERO_GRADIENT: Record<WorkerSkill, string> = {
  mozo: "bg-gradient-to-br from-primary to-primary-strong",
  bartender: "bg-gradient-to-br from-red-600 to-red-900",
  barista: "bg-gradient-to-br from-amber-500 to-amber-800",
  runner: "bg-gradient-to-br from-stone-500 to-stone-800",
  cocinero: "bg-gradient-to-br from-orange-500 to-orange-800",
  cajero: "bg-gradient-to-br from-green-600 to-green-900",
  recepcionista: "bg-gradient-to-br from-amber-600 to-amber-900",
  personal_eventos: "bg-gradient-to-br from-emerald-600 to-emerald-900",
  ayudante_cocina: "bg-gradient-to-br from-amber-500 to-orange-800",
  personal_salon: "bg-gradient-to-br from-stone-600 to-stone-900",
};

/**
 * Color de RIEL (borde izquierdo grueso) por oficio, para filas de lista que
 * siguen siendo blancas — hoy los resultados de `/search`. Es el tercer
 * registro de la misma familia: `SKILL_ACCENT` (tinte pálido para chips
 * chicos), `SKILL_HERO_GRADIENT` (banner saturado con texto blanco encima) y
 * éste, para cuando el color tiene que identificar una fila sin invadirla.
 *
 * Nace del pedido de Julieta (2026-08-17) sobre la lista de trabajadores:
 * "no me gusta todo blanco, ponele colores — naranja no". El riel diferencia
 * cada fila por su oficio principal, y el naranja queda reservado para quien
 * de verdad es mozo/cocinero en vez de pintar todo de color de marca. Tono
 * medio a propósito (-600/-700): tiene que leerse contra el blanco de la
 * tarjeta sin competir con el nombre.
 */
export const SKILL_RAIL_BORDER: Record<WorkerSkill, string> = {
  mozo: "border-l-orange-500",
  bartender: "border-l-red-700",
  barista: "border-l-amber-600",
  runner: "border-l-stone-500",
  cocinero: "border-l-orange-600",
  cajero: "border-l-green-700",
  recepcionista: "border-l-amber-700",
  personal_eventos: "border-l-emerald-700",
  ayudante_cocina: "border-l-amber-600",
  personal_salon: "border-l-stone-600",
};
