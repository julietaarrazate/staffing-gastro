"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CANDIDATES, DISTANCIA_M, LOCAL } from "./fixtures";

/**
 * "Alguien libre, a pocas cuadras": el "va en camino" de la app
 * (components/employer/EnRouteMap.tsx) sobre un mapa real de Palermo Soho,
 * con el mismo estilo (Carto Voyager). El fondo es una imagen fija de ese
 * mapa (`public/landing/mapa-palermo.webp`, 560 × 420 a 2x, armada una vez con
 * MapLibre): se ve como la app sin cargar MapLibre en la landing.
 *
 * La escena se cuenta sin palabras, en unos 8 segundos (2026-10-23): sale una
 * onda desde Tu bar y cada punto aparece cuando la onda lo alcanza; tres
 * crecen (los que se postularon, Lucía última); Lucía se pone ámbar y viene
 * hacia el local con su línea recta (recta a propósito, como en la app: es la
 * distancia que falta, no el camino), mientras bajan los metros. El pie
 * aparece una sola vez, con Lucía en camino. Vuelve a empezar si el mapa
 * salió del todo. Con "reducir movimiento" se ve el final.
 *
 * Desde el 2026-11-18 (segunda vuelta, Julieta: "sigue el mismo mapa de la
 * anterior") el mapa es el de la prueba híbrida: más celeste, y las tres
 * personas que se postulan son fotos, no círculos con iniciales; la que va
 * lleva un aro azul hondo. El pie es una ficha con su foto, su nombre y su
 * oficio, «Va en camino a Tu bar» y los metros que faltan. Se fueron del pie
 * la estrella con el puntaje y el sello de identidad: la ficha dice una sola
 * cosa. Las fotos son de banco, como las del inicio (HeroRueda.tsx).
 *
 * Sin reloj ni minutos desde el 2026-11-18 (Julieta, sobre la prueba
 * híbrida): antes un relojito pasaba de 20:46 a 20:54 ✓ y el pie decía
 * «~3 min». En la landing una hora o un tiempo de llegada se leen como una
 * promesa; la distancia, que es lo que la app sí sabe, queda.
 */
const LOCAL_XY = { x: 0.62, y: 0.4 };

type Marca = { x: number; y: number };
/** Quien se postula, con su foto: qué archivo de `public/landing/`, dónde
 *  está la cara (para encuadrarla en el círculo) y cuánto acercarla. */
type Postulante = Marca & { id: string; foto: string; cara: string; zoom: number };
const POSTULANTES: Postulante[] = [
  { id: "lucia", x: 0.3, y: 0.78, foto: "barista1", cara: "30% 12%", zoom: 1.45 },
  { id: "diego", x: 0.86, y: 0.2, foto: "bar3", cara: "84% 34%", zoom: 2.6 },
  { id: "carla", x: 0.36, y: 0.16, foto: "cocinera", cara: "34% 24%", zoom: 2.1 },
];
const AVISADOS: Marca[] = [
  { x: 0.14, y: 0.36 }, { x: 0.8, y: 0.76 }, { x: 0.52, y: 0.9 }, { x: 0.93, y: 0.52 },
  { x: 0.26, y: 0.24 }, { x: 0.07, y: 0.7 }, { x: 0.72, y: 0.08 },
];

const LUCIA = CANDIDATES[0];
/** Cuánto tarda en acercarse y hasta dónde llega (fracción del camino). */
const VIAJE_MS = 5500;
const LLEGA = 0.68;

/** Coordenadas del dibujo de las líneas: el mapa es 4:3. */
const sx = (x: number) => x * 100;
const sy = (y: number) => y * 75;
/** Cuándo alcanza la onda a cada punto (la onda tarda 1,1 s en abrirse). */
const demoraOnda = (m: Marca) => `${Math.round((Math.hypot(m.x - LOCAL_XY.x, (m.y - LOCAL_XY.y) * 0.75) / 0.62) * 1100)}ms`;

export default function MapaCamino() {
  const caja = useRef<HTMLDivElement>(null);
  // 0: nadie · 1: avisados · 2: se postularon · 3: Lucía va en camino.
  // El servidor trae el final, así se lee completo sin JavaScript.
  const [fase, setFase] = useState(3);
  // Cuánto avanzó Lucía hacia el local (0 a LLEGA) y si ya llegó.
  const [avance, setAvance] = useState(LLEGA);
  const [llego, setLlego] = useState(true);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;
    let corriendo = false;
    const parar = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(raf);
      corriendo = false;
    };
    const desdeCero = () => {
      setFase(0);
      setAvance(0);
      setLlego(false);
    };
    const arrancar = () => {
      parar();
      corriendo = true;
      desdeCero();
      timers.push(setTimeout(() => setFase(1), 200));
      timers.push(setTimeout(() => setFase(2), 1500));
      timers.push(
        setTimeout(() => {
          setFase(3);
          const t0 = performance.now();
          const paso = (ahora: number) => {
            const k = Math.min(1, (ahora - t0) / VIAJE_MS);
            const suave = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            setAvance(suave * LLEGA);
            if (k < 1) raf = requestAnimationFrame(paso);
            else setLlego(true);
          };
          raf = requestAnimationFrame(paso);
        }, 2800)
      );
    };
    desdeCero();
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.4) {
          if (!corriendo) arrancar();
        } else if (!e.isIntersecting) {
          // Salió del todo: queda lista para empezar otra vez.
          parar();
          desdeCero();
        }
      },
      { threshold: [0, 0.4] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      parar();
    };
  }, []);

  const origen = POSTULANTES[0];
  const lucia = {
    x: origen.x + (LOCAL_XY.x - origen.x) * avance,
    y: origen.y + (LOCAL_XY.y - origen.y) * avance,
  };
  const metros = Math.round((DISTANCIA_M * (1 - avance)) / 10) * 10;

  return (
    <section aria-labelledby="mapa-titulo" data-tone="light" className="landing-sec landing-sec-dos">
      <h2 id="mapa-titulo" className="landing-h2">
        Alguien libre, <span className="whitespace-nowrap">a pocas cuadras</span>
      </h2>
      <figure className="landing-mapa landing-sec-cosa">
        <div ref={caja} className="landing-mapa-calles">
          <Image src="/landing/mapa-palermo.webp" alt="" fill sizes="560px" className="object-cover" />
          {fase === 1 && (
            <span aria-hidden className="landing-mapa-onda" style={{ left: `${LOCAL_XY.x * 100}%`, top: `${LOCAL_XY.y * 100}%` }} />
          )}
          {fase >= 3 && (
            <svg aria-hidden className="absolute inset-0 z-[2] size-full" viewBox="0 0 100 75" preserveAspectRatio="none">
              <line
                x1={sx(lucia.x)}
                y1={sy(lucia.y)}
                x2={sx(LOCAL_XY.x)}
                y2={sy(LOCAL_XY.y)}
                className="landing-mapa-linea"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          <div className="landing-mapa-local" style={{ left: `${LOCAL_XY.x * 100}%`, top: `${LOCAL_XY.y * 100}%` }}>
            <span>{LOCAL}</span>
            <i />
          </div>
          {AVISADOS.map((m, k) => (
            <span
              key={k}
              aria-hidden
              className={cn("landing-mapa-avisado", fase >= 1 && "landing-on", fase >= 3 && "landing-tenue")}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, transitionDelay: fase === 1 ? demoraOnda(m) : undefined }}
            />
          ))}
          {POSTULANTES.map((m, k) => {
            const pos = k === 0 ? lucia : m;
            return (
              <span
                key={m.id}
                aria-hidden
                className={cn(
                  "landing-mapa-persona",
                  fase === 1 && "landing-punto",
                  fase >= 2 && "landing-on",
                  fase >= 3 && k > 0 && "landing-tenue",
                  fase >= 3 && k === 0 && "landing-elegida"
                )}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transitionDelay: fase === 1 ? demoraOnda(m) : fase === 2 ? `${(2 - k) * 160}ms` : undefined,
                }}
              >
                {k === 0 && fase >= 3 && <i className={cn("landing-mapa-halo", llego && "landing-quieto")} />}
                <span className="landing-mapa-cara">
                  <Image
                    src={`/landing/${m.foto}.webp`}
                    alt=""
                    fill
                    sizes="96px"
                    className="landing-foto object-cover"
                    style={{ objectPosition: m.cara, transformOrigin: m.cara, transform: `scale(${m.zoom})` }}
                  />
                </span>
              </span>
            );
          })}
          <small className="landing-mapa-credito">© OpenStreetMap · © CARTO</small>
        </div>
        <figcaption className="landing-mapa-pie">
          <div className={cn("landing-mapa-pie-dentro", fase >= 3 && "landing-on")}>
            <span className="landing-mapa-persona-pie">
              <Image
                src={`/landing/${origen.foto}.webp`}
                alt=""
                fill
                sizes="96px"
                className="landing-foto object-cover"
                style={{ objectPosition: origen.cara, transformOrigin: origen.cara, transform: `scale(${origen.zoom * 0.85})` }}
              />
            </span>
            <span className="min-w-0">
              <b className="block text-base leading-tight text-ink">{LUCIA.full_name.split(" ")[0]}, moza</b>
              {/* Dos pedazos que no se parten: a 320 px el renglón se corta
                  entre ellos y no deja «a» colgando. */}
              <small className="block text-sm text-ink-soft">
                <span className="whitespace-nowrap">Va en camino a {LOCAL}</span>{" "}
                <span className="whitespace-nowrap">· a {metros} m</span>
              </small>
            </span>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}
