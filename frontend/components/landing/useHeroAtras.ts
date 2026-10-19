"use client";

import { useEffect, useState } from "react";

/**
 * ¿El botón del hero ya quedó arriba, fuera de la pantalla? Lo usan el
 * encabezado y la barra del celular para mostrar su propio botón.
 *
 * Busca el elemento en cada scroll en vez de observarlo una vez: el hero se
 * cambia después de montar (versión quieta → noche animada, Hero.tsx) y un
 * IntersectionObserver se quedaba mirando el nodo viejo, ya fuera de la
 * página. Mientras la noche está fijada al scroll el botón sigue "en
 * pantalla" (transparente), así que los botones aparecen al terminar la
 * escena.
 */
export function useHeroAtras(heroCtaId: string): boolean {
  const [atras, setAtras] = useState(false);

  useEffect(() => {
    let frame = 0;
    const medir = () => {
      frame = 0;
      const el = document.getElementById(heroCtaId);
      setAtras(el ? el.getBoundingClientRect().bottom < 0 : true);
    };
    const pedir = () => {
      if (!frame) frame = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heroCtaId]);

  return atras;
}
