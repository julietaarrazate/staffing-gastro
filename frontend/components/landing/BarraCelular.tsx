"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { SmartphoneIcon } from "@/components/icons";
import { useInstalar } from "@/lib/instalar";
import { useHeroAtras } from "./useHeroAtras";

/**
 * Barra fija abajo, sólo en el celular: el botón principal a mano del pulgar
 * una vez que el del hero quedó atrás. Vidrio esmerilado, como la barra de la
 * app, con un solo botón a lo ancho (Julieta, 2026-10-13: con dos botones no
 * se veía bien). En Android, si el navegador ofrece instalar, se suma un
 * ícono que instala directo. Se esconde al llegar al cierre, que ya tiene sus
 * botones. En pantallas anchas el botón vive en el encabezado.
 */
export default function BarraCelular({ heroCtaId }: { heroCtaId: string }) {
  const heroAtras = useHeroAtras(heroCtaId);
  const [enCierre, setEnCierre] = useState(false);
  const { puedeInstalarDirecto, instalar } = useInstalar();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const cierre = document.getElementById("cierre");
    if (!cierre) return;
    const io = new IntersectionObserver(([e]) => setEnCierre(e.isIntersecting || e.boundingClientRect.top < 0));
    io.observe(cierre);
    return () => io.disconnect();
  }, []);

  const visible = heroAtras && !enCierre;

  return (
    <div
      aria-hidden={visible ? undefined : true}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] sm:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-[120%]"
      )}
    >
      <div className="flex gap-2 rounded-[1.25rem] bg-background/75 p-2 shadow-[var(--shadow-float)] ring-1 ring-line backdrop-blur-xl backdrop-saturate-150">
        <Link
          href="/register?rol=comercio"
          data-cta="barra"
          tabIndex={visible ? undefined : -1}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-base font-semibold text-night shadow-[var(--shadow-primary)] active:scale-[0.97]"
        >
          Necesito personal
        </Link>
        {puedeInstalarDirecto && (
          <button
            type="button"
            data-cta="barra-instalar"
            tabIndex={visible ? undefined : -1}
            onClick={() => void instalar()}
            aria-label="Instalar Oído"
            className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-card text-ink ring-1 ring-line active:scale-[0.97]"
          >
            <SmartphoneIcon size={20} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
