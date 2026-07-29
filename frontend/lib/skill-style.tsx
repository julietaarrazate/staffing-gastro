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
