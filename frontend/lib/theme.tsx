"use client";

/**
 * Modo de apariencia de la app: claro / oscuro / sistema (rediseño 2026-09).
 *
 * El mecanismo real vive en CSS (globals.css): `data-theme` en <html> voltea
 * los tokens. Este módulo sólo:
 *   1. Recuerda la elección del usuario en localStorage.
 *   2. Aplica el atributo `data-theme` al <html> (o lo saca, para "sistema").
 *   3. Expone `useTheme()` para el control de apariencia del perfil.
 *
 * "sistema" NO fija atributo: deja que `@media (prefers-color-scheme)` de
 * globals.css decida, así sigue al dispositivo en vivo (sin recargar).
 *
 * El anti-flash (que la primera pintura no salga en claro y salte a oscuro) lo
 * resuelve `THEME_INIT_SCRIPT`, un script síncrono que el layout inyecta al
 * inicio del <body>, antes de que React hidrate.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "oido-theme";

/** Aplica la elección al <html>: atributo explícito para claro/oscuro, sin
 *  atributo para "sistema" (que queda a cargo del `@media` de CSS). */
function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage puede tirar en modo privado / storage bloqueado: caemos a
    // "sistema" en silencio, nunca romper el render por leer una preferencia.
  }
  return "system";
}

/**
 * Script síncrono anti-flash. Se serializa dentro de un <script> en el layout
 * y corre ANTES del primer paint: lee la preferencia y setea `data-theme` para
 * que la página pinte de una en el modo correcto. Envuelto en try/catch porque
 * corre antes que cualquier otra cosa y no puede permitirse tirar.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

type ThemeContextValue = {
  theme: ThemeChoice;
  setTheme: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Arranca en "system" (coincide con lo que hace el script anti-flash cuando
  // no hay preferencia guardada) y se sincroniza con localStorage al montar,
  // para no desalinear el HTML del servidor con el primer render del cliente.
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    setThemeState(readStored());
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeState(choice);
    applyTheme(choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Si no se puede persistir, al menos la sesión actual queda aplicada.
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
