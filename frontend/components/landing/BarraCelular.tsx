"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { SmartphoneIcon } from "@/components/icons";
import { estaInstalada } from "@/lib/instalar";

/**
 * Barra fija abajo, sólo en el celular: el botón principal siempre a mano del
 * pulgar una vez que el del hero quedó atrás, y un acceso a "Instalar". Se
 * esconde al llegar al cierre (que ya tiene sus botones) y no aparece con la
 * app instalada. En pantallas anchas el botón vive en el encabezado.
 */
export default function BarraCelular({ heroCtaId }: { heroCtaId: string }) {
  const [heroAtras, setHeroAtras] = useState(false);
  const [enCierre, setEnCierre] = useState(false);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    setInstalada(estaInstalada());
    if (typeof IntersectionObserver === "undefined") return;
    const hero = document.getElementById(heroCtaId);
    const cierre = document.getElementById("cierre");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroAtras(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === cierre) setEnCierre(e.isIntersecting || e.boundingClientRect.top < 0);
      }
    });
    if (hero) io.observe(hero);
    if (cierre) io.observe(cierre);
    return () => io.disconnect();
  }, [heroCtaId]);

  const visible = heroAtras && !enCierre;

  return (
    <div
      aria-hidden={visible ? undefined : true}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-400 sm:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      )}
    >
      <div className="flex gap-2.5">
        <Link
          href="/register?rol=comercio"
          data-cta="barra"
          tabIndex={visible ? undefined : -1}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-base font-semibold text-night shadow-[var(--shadow-primary)] active:scale-[0.97]"
        >
          Publicar un turno gratis
        </Link>
        {!instalada && (
          <Link
            href="/#instalar"
            data-cta="barra-instalar"
            tabIndex={visible ? undefined : -1}
            className="inline-flex h-12 items-center gap-1.5 rounded-[var(--radius-btn)] px-3.5 text-sm font-semibold text-ink ring-1 ring-ink/20 active:scale-[0.97]"
          >
            <SmartphoneIcon size={18} aria-hidden />
            Instalar
          </Link>
        )}
      </div>
    </div>
  );
}
