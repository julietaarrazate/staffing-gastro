import { useSyncExternalStore } from "react";

/** El ancho desde el que Tailwind pone `lg:` (1024 px): la compu. */
const COMPU = "(min-width: 1024px)";

// Sin `matchMedia` (jsdom en los tests, navegadores muy viejos) es el celular.
function suscribir(avisar: () => void) {
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(COMPU) : null;
  mq?.addEventListener("change", avisar);
  return () => mq?.removeEventListener("change", avisar);
}

/**
 * `true` en la compu (desde `lg`). Para lo que no se resuelve con clases: una
 * pantalla que en la compu muestra OTRA cosa (la lista con la ficha al lado) y
 * no la misma más ancha. En el servidor y en la primera pintura es `false`
 * (el celular), así que sólo sirve para pantallas que cargan sus datos del
 * lado del cliente.
 */
export function useEsCompu(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => typeof window.matchMedia === "function" && window.matchMedia(COMPU).matches,
    () => false
  );
}
