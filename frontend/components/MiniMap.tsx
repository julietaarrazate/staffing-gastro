"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ESCALA,
  aPixel,
  elegirRotulos,
  mosaicosVisibles,
  pedirTrazos,
  type Trazos,
} from "@/lib/map/mapa-chico";

/**
 * Mapa chico de un turno o un local: un DIBUJO del barrio (calles, avenidas,
 * plazas, agua y el nombre del barrio y de una avenida) con los colores de
 * siempre de un mapa, y el local como un cuadradito azul hondo con relieve,
 * con su nombre al lado si se pasa `nombre`. No se toca ni se mueve (nunca se
 * pudo); «Cómo llegar» es otro botón.
 *
 * Hasta el 2026-11-19 era un `MapView` de MapLibre: cada tarjeta bajaba el
 * motor entero y abría su propio WebGL. Ahora no hay MapLibre en las
 * pantallas que sólo muestran esta foto (Mis turnos bajó de 634 a 343 KB de
 * JS). Cómo se dibuja: `lib/map/mapa-chico.ts`; números en
 * docs/reference/RENDIMIENTO.md.
 */
export default function MiniMap({
  latitude,
  longitude,
  className = "h-28 w-full",
  nombre,
}: {
  latitude: number;
  longitude: number;
  className?: string;
  /** El nombre del local, en una etiqueta arriba del cuadradito. */
  nombre?: string | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [trazos, setTrazos] = useState<Record<string, Trazos>>({});

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mosaicos = useMemo(
    () => (tam ? mosaicosVisibles(aPixel(latitude, longitude), tam.w, tam.h) : []),
    [tam, latitude, longitude],
  );

  useEffect(() => {
    let vivo = true;
    for (const m of mosaicos) {
      void pedirTrazos(m.x, m.y).then((t) => {
        if (vivo && t) setTrazos((prev) => ({ ...prev, [`${m.x}/${m.y}`]: t }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [mosaicos]);

  const { barrio, avenida } = useMemo(
    () =>
      tam ? elegirRotulos(mosaicos, (m) => trazos[`${m.x}/${m.y}`], tam.w, tam.h) : { barrio: null, avenida: null },
    [mosaicos, trazos, tam],
  );

  return (
    <div ref={caja} className={`mapa-chico ${className} rounded-2xl`} aria-hidden>
      {tam && (
        <svg className="mapa-chico-dibujo" width={tam.w} height={tam.h} viewBox={`0 0 ${tam.w} ${tam.h}`}>
          {mosaicos.map((m) => {
            const t = trazos[`${m.x}/${m.y}`];
            if (!t) return null;
            return (
              <g key={`${m.x}/${m.y}`} transform={`translate(${m.left} ${m.top}) scale(${ESCALA})`}>
                <path d={t.parques} className="mapa-chico-parque" />
                <path d={t.agua} className="mapa-chico-agua" />
                <path d={t.calles} className="mapa-chico-borde mapa-chico-borde-calle" />
                <path d={t.avenidas} className="mapa-chico-borde mapa-chico-borde-avenida" />
                <path d={t.calles} className="mapa-chico-calle" />
                <path d={t.avenidas} className="mapa-chico-avenida" />
              </g>
            );
          })}
          {avenida && (
            <text
              className="mapa-chico-rotulo"
              textAnchor="middle"
              dy="-5"
              transform={`translate(${avenida.x} ${avenida.y}) rotate(${avenida.angulo})`}
            >
              {avenida.nombre}
            </text>
          )}
          {barrio && (
            <text className="mapa-chico-barrio" x={barrio.x} y={barrio.y} textAnchor="middle">
              {barrio.nombre.toUpperCase()}
            </text>
          )}
        </svg>
      )}
      <i className="mapa-chico-local" />
      {nombre && <span className="mapa-chico-etiqueta">{nombre}</span>}
      <small className="mapa-chico-credito">© OpenStreetMap · © CARTO</small>
    </div>
  );
}
