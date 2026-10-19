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
// Desde el 2026-10-19 todos los rubros comparten el chip celeste con ícono
// azul hondo: los naranjas y ámbares de cada rubro sumaban acentos cálidos a
// cada pantalla (la grilla de "¿Qué necesitás?", "Cerca tuyo"). El rubro lo
// dice el ícono y el nombre; el color de cada oficio sigue en el banner
// (`SKILL_HERO_TONE`) y en el riel de la lista (`SKILL_RAIL_BORDER`).
const TINTE = "bg-secondary-tint";
const TINTA = "text-secondary-text";

export const SKILL_ACCENT: Record<
  WorkerSkill,
  { Icon: ComponentType<IconProps>; bg: string; fg: string }
> = {
  mozo: { Icon: UsersIcon, bg: TINTE, fg: TINTA },
  bartender: { Icon: GlassIcon, bg: TINTE, fg: TINTA },
  barista: { Icon: CoffeeIcon, bg: TINTE, fg: TINTA },
  runner: { Icon: RouteIcon, bg: TINTE, fg: TINTA },
  cocinero: { Icon: ChefHatIcon, bg: TINTE, fg: TINTA },
  cajero: { Icon: WalletIcon, bg: TINTE, fg: TINTA },
  recepcionista: { Icon: BellIcon, bg: TINTE, fg: TINTA },
  personal_eventos: { Icon: CalendarIcon, bg: TINTE, fg: TINTA },
  ayudante_cocina: { Icon: ChefHatIcon, bg: TINTE, fg: TINTA },
  personal_salon: { Icon: BuildingIcon, bg: TINTE, fg: TINTA },
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
 * y apagado por rubro — petróleo, espresso, pizarra, ciruela —, que sigue
 * distinguiendo dos turnos seguidos sin competir con el ámbar. El mozo, el
 * rubro más común, lleva el verde bosque de la marca (`--color-secondary`),
 * el mismo de la tarjeta "Recomendado" del home. Todos dan más de 10:1 con
 * blanco.
 */
export const SKILL_HERO_TONE: Record<WorkerSkill, string> = {
  mozo: "bg-brand", // el color de marca: el celeste claro (v6, 2026-10-09)
  bartender: "bg-[#173f4c]", // petróleo (antes vino: se leía como error)
  barista: "bg-[#4a3222]", // espresso
  runner: "bg-[#2e3a40]", // pizarra
  cocinero: "bg-[#5a2a18]", // terracota tostada
  cajero: "bg-[#23344a]", // azul noche
  recepcionista: "bg-[#3e3a2a]", // oliva
  personal_eventos: "bg-[#352642]", // ciruela
  ayudante_cocina: "bg-[#5a3a12]", // ámbar tostado
  personal_salon: "bg-[#34302b]", // piedra
};

const HERO_INK_WHITE = {
  strong: "text-white drop-shadow",
  soft: "text-white/90",
  softer: "text-white/85",
  mark: "text-white/15",
  veil: "bg-black/15",
  chip: "bg-white/20 text-white",
} as const;

const HERO_INK_ON_BRAND = {
  strong: "text-on-brand",
  soft: "text-on-brand/90",
  softer: "text-on-brand/85",
  mark: "text-on-brand/15",
  veil: "bg-brand-veil",
  chip: "bg-on-brand/20 text-on-brand",
} as const;

/**
 * Tinta del texto del banner. Los rubros llevan tonos profundos con texto
 * blanco, y la foto lleva un velo negro. El mozo sin foto va sobre el color
 * de marca, que desde la paleta celeste (2026-10-09) es clara: `on-brand` es
 * tinta (13,99 sobre el celeste; el blanco daría 1,35).
 */
export function heroInk(position: WorkerSkill, hasPhoto: boolean) {
  return !hasPhoto && SKILL_HERO_TONE[position] === "bg-brand" ? HERO_INK_ON_BRAND : HERO_INK_WHITE;
}

/** Cuadradito del rubro (ícono o inicial): el tono del banner con su tinta. */
export function heroTile(position: WorkerSkill) {
  const tone = SKILL_HERO_TONE[position];
  return `${tone} ${tone === "bg-brand" ? "text-on-brand" : "text-white"}`;
}

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
  bartender: "border-l-[#1e5566]", // mismo petróleo que el chip
  barista: "border-l-amber-600",
  runner: "border-l-stone-500",
  cocinero: "border-l-orange-600",
  cajero: "border-l-green-700",
  recepcionista: "border-l-amber-700",
  personal_eventos: "border-l-emerald-700",
  ayudante_cocina: "border-l-amber-600",
  personal_salon: "border-l-stone-600",
};
