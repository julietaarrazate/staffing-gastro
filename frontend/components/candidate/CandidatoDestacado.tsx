"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, NubesCielo } from "@/components/ui";
import { ShieldIcon, StarIcon } from "@/components/icons";
import { cldThumb } from "@/lib/cloudinary";
import { NEW_LABEL } from "@/lib/reputation";
import { firstNameOf } from "@/lib/shift-next-step";
import { datosCandidato, type CandidateSignals, type DatoCandidato } from "./CandidateSignals";

/** Hasta dos letras: la del nombre y la del último apellido. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
  return (primera + ultima).toUpperCase();
}

/**
 * La persona destacada de la lista de Candidatos (dirección suave, ADR-0028;
 * maquetas `C-Candidatos` y `C-Candidatos-sin-fotos` de la prueba de identidad
 * por pantalla): una tarjeta con su foto y el nombre encima; sin foto, una
 * tarjeta de cielo hondo con sus iniciales y sus datos en grande. Debajo va
 * «Elegir a <nombre>», el único ámbar de la pantalla.
 *
 * No decide a quién se destaca ni qué pasa al elegir: eso es de la pantalla
 * (`rankApplicants`, el primero de los recomendados, `assign`).
 */
export default function CandidatoDestacado({
  perfilId,
  nombre,
  foto,
  verificada,
  signals,
  rotulo,
  onElegir,
  eligiendo = false,
  bloqueado = false,
}: {
  perfilId: string;
  nombre: string;
  foto: string | null;
  verificada: boolean;
  signals: CandidateSignals;
  /** Por qué va primero («Mejor valorado»); sin motivo con respaldo, nada. */
  rotulo?: string | null;
  /** Sin esto no hay botón: el turno ya no admite elegir. */
  onElegir?: () => void;
  eligiendo?: boolean;
  bloqueado?: boolean;
}) {
  const [fotoRota, setFotoRota] = useState(false);
  const datos = datosCandidato(signals);
  const perfil = `/workers/${perfilId}`;
  const conFoto = Boolean(foto) && !fotoRota;
  const boton = onElegir && (
    <Button
      fullWidth
      size="lg"
      onClick={onElegir}
      loading={eligiendo}
      disabled={bloqueado}
      // Un nombre largo baja a dos renglones en vez de desbordar.
      className="h-auto whitespace-normal break-words py-3 text-center"
    >
      Elegir a {firstNameOf(nombre) ?? nombre}
    </Button>
  );

  if (conFoto) {
    return (
      <div data-destacado>
        <div className="foto-destacada no-select relative isolate h-[292px] overflow-hidden rounded-[24px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil servida por Cloudinary, ya al ancho justo */}
          <img
            src={cldThumb(foto, 800)}
            alt={`Foto de ${nombre}`}
            onError={() => setFotoRota(true)}
            decoding="async"
            draggable={false}
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_18%]"
          />
          {/* El velo oscurece donde va la letra. Sobre una foto blanca, el
              nombre en blanco da 3,9 en su renglón más alto (el segundo desde
              abajo) y más de 7 en los chips: letra grande, pide 3. */}
          <div aria-hidden className="foto-destacada-velo absolute inset-0 -z-10" />
          {rotulo && <span className="chip-foto absolute left-3 top-3 max-w-[calc(100%-1.5rem)]">{rotulo}</span>}
          <div className="absolute inset-x-4 bottom-4 text-white">
            <Link
              href={perfil}
              data-nombre-candidato
              // Toda la tarjeta lleva al perfil (el `after` cubre la foto).
              // A lo sumo dos renglones: más arriba el velo ya no oscurece
              // lo suficiente para la letra blanca (el nombre entero está en
              // el `title` y en el texto alternativo de la foto).
              title={nombre}
              className="line-clamp-2 break-words text-[length:min(2.25rem,10.5vw)] font-extrabold leading-[1.1] tracking-[-0.025em] after:absolute after:inset-0 after:content-['']"
            >
              {nombre}
            </Link>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {datos.slice(0, 4).map((d) => (
                <ChipDato key={d.clave} dato={d} />
              ))}
              {verificada && (
                <span className="chip-foto">
                  <ShieldIcon size={13} /> Identidad verificada
                </span>
              )}
            </div>
          </div>
        </div>
        {boton && <div className="mt-3.5">{boton}</div>}
      </div>
    );
  }

  // Sin foto: el cielo hondo con las iniciales, y los datos en grande.
  const cifras = datos.filter((d) => d.clave !== "nuevo").slice(0, 3);
  const esNuevo = datos.some((d) => d.clave === "nuevo");
  return (
    <div data-destacado className="tarjeta-destacada no-select relative">
      <div className="app-cielo cielo-limpio cielo-hondo p-4">
        <NubesCielo nubes={[{ forma: "b", ancho: 110, pos: { right: -10, top: 4 } }]} />
        {rotulo && <span className="chip-vidrio">{rotulo}</span>}
        {/* Con la letra muy grande el nombre baja debajo de las iniciales. */}
        <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 ${rotulo ? "mt-3.5" : ""}`}>
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-h2 font-extrabold text-[#1c5478]"
          >
            {iniciales(nombre)}
          </span>
          <div className="min-w-[min(100%,8rem)] flex-1">
            <Link
              href={perfil}
              data-nombre-candidato
              className="block break-words text-[length:min(1.75rem,8.5vw)] font-extrabold leading-[1.05] tracking-[-0.025em] after:absolute after:inset-0 after:content-['']"
            >
              {nombre}
            </Link>
            {esNuevo && <p className="mt-1 text-sm font-semibold">{NEW_LABEL}</p>}
            {verificada && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                <ShieldIcon size={14} className="shrink-0" /> Identidad verificada
              </p>
            )}
          </div>
        </div>
      </div>
      {cifras.length > 0 && (
        <div className="p-4">
          {/* Recorta la raya de la primera columna de cada renglón. */}
          <div className="overflow-hidden">
            <dl className="cifras-destacada grid">
              {cifras.map((d) => (
                <div key={d.clave} className="min-w-0">
                  {/* El número arriba y su rótulo abajo, pero el rótulo es el
                      término: `flex-col-reverse` mantiene el orden de lectura. */}
                  <div className="flex flex-col-reverse">
                    <dt className="mt-1.5 break-words text-metadata leading-tight text-ink-soft">{d.rotulo}</dt>
                    <dd className="flex items-center gap-1 whitespace-nowrap text-[length:min(1.625rem,7vw)] font-extrabold leading-[0.95] tracking-[-0.035em] tabular-nums text-ink">
                      {d.numero}
                      {d.clave === "nota" && <StarIcon size={16} filled className="shrink-0 text-primary-text" />}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
      {/* Por encima del link que cubre la tarjeta. */}
      {boton && <div className={`relative z-[1] px-4 pb-4 ${cifras.length === 0 ? "pt-4" : ""}`}>{boton}</div>}
    </div>
  );
}

function ChipDato({ dato }: { dato: DatoCandidato }) {
  return (
    <span className="chip-foto">
      {dato.clave === "nota" && (
        <>
          <StarIcon size={13} filled />
          <span className="sr-only">Calificación </span>
        </>
      )}
      {dato.texto}
    </span>
  );
}
