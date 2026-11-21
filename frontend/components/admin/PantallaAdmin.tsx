"use client";

// La cáscara compartida de toda la Administración con la dirección suave
// (ADR-0028, 2026-11-21). El admin es una herramienta de trabajo con tablas y
// listas densas, así que NO lleva el cielo alto de las pantallas de la app:
// lleva el cielo corto y liso de las subpantallas (como `SubpaginaSuave`), con
// el título de la pantalla sobre el cielo, y debajo la hoja con la navegación
// del panel y el contenido. Cada pantalla pone su título con `AdminHeading`
// (que no dibuja nada: se lo cuenta a la cáscara); sin título, la cáscara usa
// el nombre de la sección.

import Link from "next/link";
import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeftIcon, ShieldIcon } from "@/components/icons";

export type TituloAdmin = {
  title: string;
  subtitle?: string;
  /** Una vuelta a la lista (la ficha de una persona). */
  volver?: { href: string; label: string };
};

type Ctx = { setTitulo: (t: TituloAdmin | null) => void };
const TituloCtx = createContext<Ctx>({ setTitulo: () => {} });

/** Lo llama `AdminHeading`: dice qué título lleva el cielo mientras la pantalla está montada. */
export function useTituloAdmin(t: TituloAdmin) {
  const { setTitulo } = useContext(TituloCtx);
  const { title, subtitle } = t;
  const href = t.volver?.href;
  const label = t.volver?.label;
  useLayoutEffect(() => {
    setTitulo({ title, subtitle, volver: href && label ? { href, label } : undefined });
    return () => setTitulo(null);
  }, [setTitulo, title, subtitle, href, label]);
}

export function PantallaAdmin({
  tituloPorDefecto,
  menu,
  children,
}: {
  tituloPorDefecto: string;
  menu: ReactNode;
  children: ReactNode;
}) {
  const [titulo, setTitulo] = useState<TituloAdmin | null>(null);
  const ctx = useMemo(() => ({ setTitulo }), []);
  const t = titulo ?? { title: tituloPorDefecto };
  return (
    <TituloCtx.Provider value={ctx}>
      <div className="estilo-suave admin-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] w-full max-w-[72rem] flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:px-4 md:pt-4">
        <div className="app-cielo cielo-limpio px-4 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-5 print:hidden">
          {t.volver ? (
            <Link href={t.volver.href} aria-label={t.volver.label} className="boton-vidrio h-11 w-11">
              <ChevronLeftIcon size={18} />
            </Link>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldIcon size={15} /> Administración
            </p>
          )}
          <h1 className="titulo-pantalla mt-3 break-words">{t.title}</h1>
          {t.subtitle && <p className="mt-1 break-words text-sm font-medium">{t.subtitle}</p>}
        </div>
        <div className="hoja admin-hoja -mt-7 flex-1 px-4 pb-10 pt-6 md:px-6 print:mt-0 print:shadow-none">
          <div className="md:flex md:gap-8">
            {menu}
            <div className="mt-5 min-w-0 flex-1 md:mt-0">{children}</div>
          </div>
        </div>
      </div>
    </TituloCtx.Provider>
  );
}
