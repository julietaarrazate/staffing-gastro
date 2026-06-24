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

export const SKILL_STYLES: Record<
  WorkerSkill,
  { Icon: ComponentType<IconProps>; gradient: string }
> = {
  mozo: { Icon: UsersIcon, gradient: "from-orange-500 to-red-500" },
  bartender: { Icon: GlassIcon, gradient: "from-purple-500 to-indigo-600" },
  barista: { Icon: CoffeeIcon, gradient: "from-amber-600 to-orange-700" },
  runner: { Icon: RouteIcon, gradient: "from-sky-500 to-blue-600" },
  cocinero: { Icon: ChefHatIcon, gradient: "from-red-500 to-rose-600" },
  cajero: { Icon: WalletIcon, gradient: "from-emerald-500 to-teal-600" },
  recepcionista: { Icon: BellIcon, gradient: "from-pink-500 to-rose-500" },
  personal_eventos: { Icon: CalendarIcon, gradient: "from-violet-500 to-purple-600" },
  ayudante_cocina: { Icon: ChefHatIcon, gradient: "from-orange-400 to-amber-600" },
  personal_salon: { Icon: BuildingIcon, gradient: "from-zinc-600 to-zinc-800" },
};
