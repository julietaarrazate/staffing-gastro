"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export const HERO_CTA_ID = "hero-ctas";

/**
 * Primera pantalla (2026-10-18): "Encontrá tu ___" con la palabra que cambia
 * y una rueda de fotos de gente de gastronomía que gira despacio alrededor
 * del título, a la manera de coofounder.app. Julieta: "es clara con lo que
 * comunica, se entiende de inmediato qué hace Oído". Sin subtítulo: sólo el
 * título y los dos caminos.
 *
 * El HTML del servidor trae el título y los botones; la rueda se arma en el
 * navegador porque depende del ancho, entra con un fundido y deja de girar
 * cuando el inicio sale de pantalla. La palabra cambia como un cartel de
 * estación (2026-10-23). Con "reducir movimiento" queda quieta y la palabra
 * no cambia.
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
  // `antes` es la palabra que sale (sube y se apaga) mientras entra la nueva:
  // un cartel de estación, sin que cambie el alto del título.
  const [par, setPar] = useState<{ i: number; antes: number | null }>({ i: 0, antes: null });
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const correr = () => {
      clearInterval(id);
      id = setInterval(() => setPar((p) => ({ i: (p.i + 1) % PUESTOS.length, antes: p.i })), 2400);
    };
    // Sólo cambia mientras el inicio está en pantalla.
    const seccion = ref.current?.closest("section");
    const io =
      seccion && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => (e.isIntersecting ? correr() : clearInterval(id)), { threshold: 0 })
        : null;
    if (io && seccion) io.observe(seccion);
    else correr();
    return () => {
      clearInterval(id);
      io?.disconnect();
    };
  }, []);
  return (
    <span ref={ref} aria-hidden className="landing-palabra block text-primary">
      {par.antes !== null && (
        <b key={`s${par.antes}-${par.i}`} className="landing-palabra-sale font-semibold">
          {PUESTOS[par.antes]}
        </b>
      )}
      <b key={`e${par.i}`} className="font-semibold">
        {PUESTOS[par.i]}
      </b>
    </span>
  );
}

function Rueda() {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

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
      // El inicio sube debajo del encabezado transparente (`--lht`).
      rueda.style.top = `calc(var(--lht) + ${24 + (ancho * 1.3) / 2 + radio}px)`;
      setN(Math.max(14, Math.round((2 * Math.PI * radio) / (ancho * 1.55))));
    };
    // Fuera de pantalla no gira (no gasta cuadros).
    let visible = true;
    const girar = (ahora: number) => {
      fase -= Math.min(50, ahora - antes) * 0.000045;
      antes = ahora;
      pintar();
      raf = visible ? requestAnimationFrame(girar) : 0;
    };

    medir();
    const alCambiar = () => medir();
    window.addEventListener("resize", alCambiar);
    const seccion = rueda.closest("section");
    const io =
      seccion && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              visible = e.isIntersecting;
              if (!visible) {
                cancelAnimationFrame(raf);
                raf = 0;
              } else if (!reducir && !raf) {
                antes = performance.now();
                raf = requestAnimationFrame(girar);
              }
            },
            { threshold: 0 }
          )
        : null;
    if (io && seccion) io.observe(seccion);
    // Primer cuadro después de que React pinte las fichas; entra con un fundido.
    raf = requestAnimationFrame(() => {
      pintar();
      rueda.dataset.listo = "";
      raf = !reducir && visible ? requestAnimationFrame(girar) : 0;
    });
    return () => {
      window.removeEventListener("resize", alCambiar);
      io?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n]);

  return (
    <div ref={ref} aria-hidden className="landing-rueda">
      {Array.from({ length: n }, (_, k) => (
        <div key={k} data-ficha className="landing-ficha">
          <Image src={`/landing/${FOTOS[k % FOTOS.length]}.webp`} alt="" fill sizes="180px" className="object-cover" />
        </div>
      ))}
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
          className="font-display text-[clamp(3.25rem,5.6vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink"
        >
          <span className="block">Encontrá tu</span>
          <span className="sr-only">mozo, bartender, bachero o cocinero</span>
          <PalabraQueCambia />
        </h1>
        <div id={HERO_CTA_ID} className="landing-par mt-9">
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
