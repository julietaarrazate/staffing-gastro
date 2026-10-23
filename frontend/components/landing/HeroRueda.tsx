"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

export const HERO_CTA_ID = "hero-ctas";

/**
 * Primera pantalla (2026-10-18): "Encontrá tu ___" con la palabra que cambia
 * y una rueda de fotos de gente de gastronomía que gira despacio alrededor
 * del título, a la manera de coofounder.app. Julieta: "es clara con lo que
 * comunica, se entiende de inmediato qué hace Oído". Sin subtítulo: sólo el
 * título y los dos caminos.
 *
 * El HTML del servidor trae el título y los botones; la rueda se arma en el
 * navegador porque depende del ancho. Con "reducir movimiento" queda quieta
 * y la palabra no cambia.
 *
 * Las fotos son de prueba, en dominio público o CC0 (Openverse); autores en
 * docs/historial/2026-10-18-landing-cielo.md. Hay que reemplazarlas por
 * fotos propias de locales porteños.
 */
const FOTOS = [
  "mozo2", "barista1", "bar3", "cocinera", "mozo1", "cocina2",
  "bar2", "barista2", "mozo3", "cocina3", "bar1", "cocina1",
];

const PUESTOS = ["mozo", "bartender", "bachero", "barista", "cocinero", "runner", "cajera", "moza"];

function PalabraQueCambia() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % PUESTOS.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <span aria-hidden className="landing-palabra block text-primary">
      {/* `key` remonta el texto y dispara la entrada (globals.css). */}
      <b key={PUESTOS[i]} className="font-semibold">
        {PUESTOS[i]}
      </b>
    </span>
  );
}

/** Lo que `next/image` pide para cada ficha (mismo `sizes`, mismo srcset). */
const fichaProps = (k: number) =>
  getImageProps({ src: `/landing/${FOTOS[k % FOTOS.length]}.webp`, alt: "", fill: true, sizes: "180px" }).props;

function Rueda() {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  // La rueda se arma en el navegador (depende del ancho), así que sus fotos no
  // están en el HTML del servidor. Este preload sí sale en el <head>: el
  // navegador las empieza a bajar antes de hidratar. Van la 0 y la 1 porque
  // en 390 px el LCP es la 1 (la 0 queda recortada arriba y pinta menos
  // área); precargar sólo la 0 no movió el LCP (medido 2026-10-23).
  for (const k of [0, 1]) {
    const f = fichaProps(k);
    preload(f.src, { as: "image", imageSrcSet: f.srcSet, imageSizes: f.sizes, fetchPriority: "high" });
  }

  useEffect(() => {
    const rueda = ref.current;
    if (!rueda) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let radio = 0;
    let fase = 0;
    let raf = 0;
    let antes = performance.now();

    const pintar = () => {
      const fichas = rueda.querySelectorAll<HTMLElement>("[data-ficha]");
      const cw = fichas[0]?.offsetWidth ?? 0;
      const ch = fichas[0]?.offsetHeight ?? 0;
      fichas.forEach((f, k) => {
        const a = fase + (k / fichas.length) * Math.PI * 2;
        f.style.transform = `translate(${Math.sin(a) * radio - cw / 2}px, ${-Math.cos(a) * radio - ch / 2}px) rotate(${a}rad)`;
      });
    };
    const medir = () => {
      const w = window.innerWidth;
      const ancho = w < 600 ? 104 : w < 1000 ? 140 : 170;
      radio = w < 600 ? 560 : w < 1000 ? 640 : Math.min(860, w * 0.53);
      rueda.style.top = `${24 + (ancho * 1.3) / 2 + radio}px`;
      setN(Math.max(14, Math.round((2 * Math.PI * radio) / (ancho * 1.55))));
    };
    const girar = (ahora: number) => {
      fase -= Math.min(50, ahora - antes) * 0.000045;
      antes = ahora;
      pintar();
      raf = requestAnimationFrame(girar);
    };

    medir();
    const alCambiar = () => medir();
    window.addEventListener("resize", alCambiar);
    // Primer cuadro después de que React pinte las fichas.
    raf = requestAnimationFrame(() => {
      pintar();
      if (!reducir) raf = requestAnimationFrame(girar);
    });
    return () => {
      window.removeEventListener("resize", alCambiar);
      cancelAnimationFrame(raf);
    };
  }, [n]);

  return (
    <div ref={ref} aria-hidden className="landing-rueda">
      {Array.from({ length: n }, (_, k) => {
        // La ficha 0 arranca arriba al centro; la 1 y la última son sus
        // vecinas. Las tres se ven en 390 px de entrada. Con el `lazy` por
        // defecto el navegador esperaba al layout para pedirlas (Lighthouse:
        // ~0,5 s de "resource load delay" en el LCP). El resto, fuera de
        // pantalla hasta que la rueda gira, sigue en lazy.
        const aLaVista = k === 0 || k === 1 || k === n - 1;
        return (
          <div key={k} data-ficha className="landing-ficha">
            <Image
              src={`/landing/${FOTOS[k % FOTOS.length]}.webp`}
              alt=""
              fill
              sizes="180px"
              className="object-cover"
              loading={aLaVista ? "eager" : "lazy"}
              fetchPriority={k <= 1 ? "high" : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function HeroRueda() {
  return (
    <section aria-labelledby="hero-titulo" data-tone="light" className="landing-hero relative overflow-hidden px-4 text-center sm:px-6">
      {/* El marco funde la rueda hacia abajo: sin él, en pantallas anchas las
          fichas de los costados se cortaban en seco contra el borde. */}
      <div aria-hidden className="landing-rueda-marco">
        <Rueda />
      </div>
      <div className="relative z-[2]">
        <h1
          id="hero-titulo"
          className="font-display text-[clamp(3.25rem,6.6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink"
        >
          <span className="block">Encontrá tu</span>
          <span className="sr-only">mozo, bartender, bachero o cocinero</span>
          <PalabraQueCambia />
        </h1>
        <div id={HERO_CTA_ID} className="mt-9 flex flex-wrap justify-center gap-2.5">
          <Link href="/register?rol=comercio" data-cta="hero" className="landing-btn landing-btn-primario">
            Necesito personal <span aria-hidden className="landing-btn-flecha">→</span>
          </Link>
          <Link href="/register?rol=trabajador" data-cta="hero-trabajo" className="landing-btn landing-btn-borde">
            Quiero trabajar <span aria-hidden className="landing-btn-flecha">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
