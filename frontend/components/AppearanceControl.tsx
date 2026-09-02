"use client";

/**
 * Control de apariencia (Perfil → Apariencia): un segmentado de 3 opciones
 * — Sistema / Claro / Oscuro — para elegir el modo de color de la app.
 * Escribe la preferencia vía `useTheme()` (lib/theme.tsx), que la persiste y
 * aplica `data-theme` al <html>. "Sistema" sigue al dispositivo en vivo.
 */

import { useTheme, type ThemeChoice } from "@/lib/theme";
import { SunIcon, MoonIcon, MonitorIcon, type IconProps } from "@/components/icons";
import type { ComponentType } from "react";

const OPTIONS: { value: ThemeChoice; label: string; Icon: ComponentType<IconProps> }[] = [
  { value: "system", label: "Sistema", Icon: MonitorIcon },
  { value: "light", label: "Claro", Icon: SunIcon },
  { value: "dark", label: "Oscuro", Icon: MoonIcon },
];

export default function AppearanceControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      className="flex gap-1.5 rounded-[var(--radius-card)] bg-card p-1.5 shadow-[var(--shadow-soft)] ring-1 ring-line"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-btn)] px-2 py-3 text-xs font-semibold transition active:scale-[0.97] ${
              active
                ? "bg-primary text-night shadow-[0_4px_12px_rgba(249,78,27,0.28)]"
                : "text-ink/55 hover:bg-surface"
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
