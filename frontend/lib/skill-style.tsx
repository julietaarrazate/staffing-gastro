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
  bartender: { Icon: GlassIcon, bg: "bg-[#f7eaea]", fg: "text-[#7f2b2b]" }, // borgoña, no el rojo de error
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
 * Tono PROFUNDO por rubro, para el banner de una tarjeta de turno cuando el
 * comercio no subió foto (`OpportunityCard`, `ShiftCard`, mapa, búsqueda,
 * landing). Lleva texto blanco encima, por eso es oscuro.
 *
 * Historia: el banner sin foto fue tinte pálido ("muy beige, plano"), después
 * un único naranja de marca ("todas iguales"), después un gradiente SATURADO
 * por rubro (Julieta, 2026-08-16: que dos turnos seguidos no se sientan la
 * misma tarjeta). Con el Design System v5.0 (lienzo blanco, el color para
 * acentos y para "levantar" con criterio, 2026-09-22) el gradiente saturado
 * quedó como la única superficie que gritaba: pasa a un tono PLANO, profundo
 * y apagado por rubro — vino, espresso, pizarra, ciruela —, que sigue
 * distinguiendo dos turnos seguidos sin competir con el ámbar. El mozo, el
 * rubro más común, lleva el verde bosque de la marca (`--color-secondary`),
 * el mismo de la tarjeta "Recomendado" del home. Todos dan más de 10:1 con
 * blanco.
 */
export const SKILL_HERO_TONE: Record<WorkerSkill, string> = {
  mozo: "bg-secondary",
  bartender: "bg-[#4a1d26]", // vino
  barista: "bg-[#4a3222]", // espresso
  runner: "bg-[#2e3a40]", // pizarra
  cocinero: "bg-[#5a2a18]", // terracota tostada
  cajero: "bg-[#23344a]", // azul noche
  recepcionista: "bg-[#3e3a2a]", // oliva
  personal_eventos: "bg-[#352642]", // ciruela
  ayudante_cocina: "bg-[#5a3a12]", // ámbar tostado
  personal_salon: "bg-[#34302b]", // piedra
};

/**
 * Color de RIEL (borde izquierdo grueso) por oficio, para filas de lista que
 * siguen siendo blancas — hoy los resultados de `/search`. Es el tercer
 * registro de la misma familia: `SKILL_ACCENT` (tinte pálido para chips
 * chicos), `SKILL_HERO_TONE` (banner saturado con texto blanco encima) y
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
  bartender: "border-l-[#7f2b2b]", // mismo borgoña que el hero, no el rojo de error
  barista: "border-l-amber-600",
  runner: "border-l-stone-500",
  cocinero: "border-l-orange-600",
  cajero: "border-l-green-700",
  recepcionista: "border-l-amber-700",
  personal_eventos: "border-l-emerald-700",
  ayudante_cocina: "border-l-amber-600",
  personal_salon: "border-l-stone-600",
};
