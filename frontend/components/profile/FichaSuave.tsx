"use client";

import { useState } from "react";
import { cldThumb } from "@/lib/cloudinary";
import { ChevronLeftIcon } from "@/components/icons";
import { NubesCielo, SinFoto } from "@/components/ui";

/**
 * La cáscara de la ficha pública de una persona o de un comercio
 * (`/workers/[id]`, `/companies/[id]`) con la dirección suave (ADR-0028): lo
 * mismo que la persona ve en su propio perfil (`worker/PerfilTrabajador`,
 * `company/PerfilComercio`), visto desde afuera. El cielo con la vuelta en un
 * botón de vidrio, el nombre y la zona; la foto o el logo a caballo de la
 * hoja, con el sello si lo hay; y la hoja con el contenido que le pasa cada
 * ficha.
 *
 * Los datos que se muestran y a quién no los decide esta pieza sino la
 * pantalla que la usa: acá sólo hay piel.
 */
export default function FichaSuave({
  titulo,
  bajada,
  fotoUrl,
  inicial,
  idFoto,
  sello,
  cargando = false,
  onVolver,
  children,
}: {
  /** El nombre. Mientras `cargando`, o sin él, el cielo lleva «Perfil» sólo para lectores. */
  titulo?: string | null;
  /** Una línea debajo del nombre (ciudad; rubro · ciudad). */
  bajada?: string;
  fotoUrl?: string | null;
  /** De acá sale la letra del cielo que reemplaza a la foto cuando falta, o no carga. */
  inicial?: string;
  /** Id del perfil: elige la nube de ese cielo (`SinFoto`). */
  idFoto?: string;
  /** Lo que va a la derecha de la foto, sobre la hoja (identidad verificada). */
  sello?: React.ReactNode;
  cargando?: boolean;
  /** Sin esto no hay botón de vuelta en el cielo (el error trae el suyo, abajo). */
  onVolver?: () => void;
  children: React.ReactNode;
}) {
  // Una foto que no carga (archivo borrado, sin red) vuelve a la inicial.
  const [rota, setRota] = useState<string | null>(null);
  const conFoto = Boolean(fotoUrl) && rota !== fotoUrl;

  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      <div className="app-cielo cielo-limpio px-5 pb-11 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6">
        <NubesCielo nubes={[{ forma: "a", ancho: 250, pos: { right: -56, top: 44 } }]} />
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver"
            className="boton-vidrio mb-3 h-11 w-11 shrink-0 transition active:scale-95"
          >
            <ChevronLeftIcon size={20} />
          </button>
        )}
        {/* Mientras no se sabe el nombre no se pone otro para cambiarlo un
            instante después: una barra, y el `h1` sólo para lectores. */}
        {cargando || !titulo ? (
          <>
            <h1 className="sr-only">Perfil</h1>
            {cargando && (
              <div
                aria-hidden
                className="h-[35px] w-[62%] animate-pulse rounded-full bg-[rgba(255,255,255,0.35)] motion-reduce:animate-none"
              />
            )}
          </>
        ) : (
          <h1 className="titulo-pantalla break-words">{titulo}</h1>
        )}
        {bajada && <p className="mt-1 break-words text-fila font-semibold">{bajada}</p>}
        {/* El lugar de la foto, que asoma desde la hoja. */}
        <div aria-hidden className="mt-4 h-8" />
      </div>

      <div className="hoja -mt-7 flex-1 px-5 pb-10 pt-[18px] md:px-6">
        <div className="perfil-foto absolute left-5 top-[-60px] z-[2] md:left-6">
          {conFoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto chica (108 px) de Cloudinary, no amerita next/image
            <img
              src={cldThumb(fotoUrl, 216)}
              alt=""
              width={108}
              height={108}
              decoding="async"
              onError={() => setRota(fotoUrl ?? null)}
              className="foto-subir h-[108px] w-[108px] rounded-full object-cover"
            />
          ) : (
            <div className="foto-subir h-[108px] w-[108px] overflow-hidden rounded-full">
              <SinFoto nombre={cargando ? "" : inicial} id={idFoto} />
            </div>
          )}
        </div>
        <div className="flex min-h-8 justify-end pl-[124px]">{sello}</div>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}
