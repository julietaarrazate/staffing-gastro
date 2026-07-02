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
 * Acento sobrio por rubro (DS v2): paleta gastronómica cálida, SIN violeta/
 * fucsia. Se usa sólo en el chip del ícono sobre tarjetas blancas/foto —
 * nunca como banda de color a toda la tarjeta. Da reconocimiento rápido del
 * puesto sin romper el lenguaje monocromático.
 */
export const SKILL_ACCENT: Record<
  WorkerSkill,
  { Icon: ComponentType<IconProps>; bg: string; fg: string }
> = {
  mozo: { Icon: UsersIcon, bg: "bg-orange-50", fg: "text-orange-600" },
  bartender: { Icon: GlassIcon, bg: "bg-rose-50", fg: "text-rose-600" },
  barista: { Icon: CoffeeIcon, bg: "bg-amber-50", fg: "text-amber-700" },
  runner: { Icon: RouteIcon, bg: "bg-teal-50", fg: "text-teal-700" },
  cocinero: { Icon: ChefHatIcon, bg: "bg-red-50", fg: "text-red-600" },
  cajero: { Icon: WalletIcon, bg: "bg-emerald-50", fg: "text-emerald-700" },
  recepcionista: { Icon: BellIcon, bg: "bg-orange-50", fg: "text-orange-700" },
  personal_eventos: { Icon: CalendarIcon, bg: "bg-lime-50", fg: "text-lime-700" },
  ayudante_cocina: { Icon: ChefHatIcon, bg: "bg-amber-50", fg: "text-amber-700" },
  personal_salon: { Icon: BuildingIcon, bg: "bg-stone-100", fg: "text-stone-700" },
};
