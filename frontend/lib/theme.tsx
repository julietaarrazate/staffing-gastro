"use client";

/**
 * Modo de apariencia de la app: claro / oscuro / sistema (rediseño 2026-09).
 *
 * El mecanismo real vive en CSS (globals.css): `data-theme` en <html> voltea
 * los tokens. Este módulo:
 *   1. Recuerda la ELECCIÓN del usuario en localStorage ("system"/"light"/"dark").
 *   2. RESUELVE esa elección a un modo concreto y lo escribe SIEMPRE en
 *      `data-theme` ("dark"|"light"). "Sistema" resuelve a claro: la app no
 *      se oscurece sola (ver `resolveTheme`).
 *   3. Expone `useTheme()` (la elección, para el control de apariencia) y
 *      `useResolvedTheme()` (el modo real pintado, para los componentes que lo
 *      necesitan en JS).
 *
 * Por qué se resuelve acá y no con `@media` en CSS (cambio 2026-09): mientras
 * "sistema" no fijaba atributo, los valores oscuros tenían que estar
 * duplicados en dos bloques CSS mantenidos a mano (uno por `@media`, otro por
 * `data-theme="dark"`). Se desincronizaron dos veces y las dos salieron como
 * bugs reales con captura (#308, #313). Además el modo resuelto era invisible
 * desde JS, así que cada componente que lo necesitaba lo re-derivaba con su
 * propio `matchMedia` — el botón de Google se renderizaba en su variante clara
 * sobre tarjeta oscura por esa desconexión. Resolviendo acá, CSS y JS leen el
 * mismo dato y el drift deja de ser posible.
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
/** El modo realmente pintado, con la elección ya resuelta. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "oido-theme";

/**
 * Resuelve la elección al modo que efectivamente se pinta.
 *
 * "Sistema" NO oscurece la app aunque el dispositivo esté en oscuro (decisión
 * de Julieta, 2026-09). Dos motivos:
 *
 * 1. Con el teléfono en oscuro, "Sistema" y "Oscuro" daban exactamente la misma
 *    pantalla: dos opciones distintas del selector de Apariencia para un único
 *    resultado ("cuando entro a la app ambos modos son iguales, eso es lo que
 *    no quiero justamente").
 * 2. La identidad de Oído es el crema cálido. La app no se apaga sola por una
 *    preferencia del sistema operativo — mismo criterio que la landing, que se
 *    sirve siempre clara. El oscuro es una elección explícita del usuario, no
 *    algo que le pasa a la app.
 *
 * Consecuencia a mirar: "Sistema" queda hoy equivalente a "Claro". Si el
 * selector se siente redundante con tres opciones, la más limpia es dejar
 * Claro/Oscuro — es sacar una entrada de `OPTIONS` en `AppearanceControl.tsx`.
 */
function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "dark" ? "dark" : "light";
}

/** Escribe el modo RESUELTO en <html>. Siempre hay atributo: es la única
 *  fuente de verdad que leen tanto el CSS como el JS. */
function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", resolved);
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
 * y corre ANTES del primer paint: lee la preferencia guardada y setea
 * `data-theme`, para que la página pinte de una en el modo correcto y para que
 * el atributo exista desde el primer frame. Envuelto en try/catch porque
 * corre antes que cualquier otra cosa y no puede permitirse tirar.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('${STORAGE_KEY}');document.documentElement.setAttribute('data-theme',c==='dark'?'dark':'light');}catch(e){}})();`;

type ThemeContextValue = {
  /** Lo que eligió el usuario: incluye "system". Para el control de apariencia. */
  theme: ThemeChoice;
  /** El modo realmente pintado, ya resuelto. Para lógica que necesita saber
   *  si está oscuro (widgets de terceros, canvas, mapas). */
  resolvedTheme: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Arranca en "system"/"light" (coincide con lo que hace el script anti-flash
  // cuando no hay preferencia guardada) y se sincroniza con localStorage al
  // montar, para no desalinear el HTML del servidor con el primer render del
  // cliente.
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readStored();
    setThemeState(stored);
    setResolvedTheme(resolveTheme(stored));
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    const resolved = resolveTheme(choice);
    setThemeState(choice);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Si no se puede persistir, al menos la sesión actual queda aplicada.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}

/** El modo realmente pintado ("light"/"dark"), con "sistema" ya resuelto.
 *  Usalo en vez de re-derivarlo con `matchMedia` en cada componente. */
export function useResolvedTheme(): ResolvedTheme {
  return useTheme().resolvedTheme;
}
