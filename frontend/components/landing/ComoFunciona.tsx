"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CandidateCard from "@/components/CandidateCard";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { Avatar, Rating } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatKm } from "@/lib/format";
import { CANDIDATES, MAP_WORKERS, PEDIDO } from "./fixtures";
import RelojDelTurno from "./RelojDelTurno";
import { DescribeBox, PricePin, StreetGrid, ToastLine, WorkerPin } from "./replicas";
import Reveal from "./Reveal";
import { useStoryShift } from "./useStoryShift";

/**
 * Cómo funciona, en tres pasos con su título (`h3`) fijo y una imagen quieta
 * del producto al lado. Los números son los del producto: el aviso a los 10
 * más indicados (`NEARBY_NOTIFICATION_LIMIT`) y la ampliación a los 8 minutos
 * (`ESCALATION_DELAY`), los dos en backend/app/modules/shift/application/
 * services.py. Cierra con la banda "¡Oído!", el único momento de marca.
 */
export default function ComoFunciona() {
  const shift = useStoryShift("publicado");
  return (
    <>
      <section
        id="como-funciona"
        aria-labelledby="como-funciona-titulo"
        data-tone="light"
        className="scroll-mt-[var(--lht)] px-4 py-20 sm:px-6 lg:px-12 lg:py-28"
      >
        <h2
          id="como-funciona-titulo"
          className="font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          Así se cubre un turno
        </h2>
        <ol className="mt-14 flex flex-col gap-20 lg:mt-20 lg:gap-28">
          <Paso
            n={1}
            titulo="Contalo como lo dirías"
            alt="Escribís “Necesito un mozo hoy de 21 a 2, pago 70.000” y Oído arma el turno: puesto, horario y pago."
          >
            <div className="flex flex-col items-center gap-5">
              <PedidoEscribiendose />
              {/* En el celular alcanza con la frase y sus piezas: la tarjeta
                  sola suma media pantalla. */}
              <div className="hidden h-[285px] w-[240px] lg:block">
                <div className="anim-rise h-[380px] w-[320px] origin-top-left scale-[0.75]" style={{ ["--d" as string]: "3.4s" }}>
                  <OpportunityCard shift={shift} preview />
                </div>
              </div>
            </div>
          </Paso>
          <Paso
            n={2}
            titulo="Le llega a quien está cerca"
            alt="El aviso les llega primero a los 10 más indicados de la zona; a los pocos minutos, tres ya se postularon."
          >
            <MapaAviso />
          </Paso>
          <Paso
            n={3}
            titulo="Elegís y te confirma"
            alt="Ves a cada postulante con su puntaje, su puntualidad y su distancia; la asignás y te confirma."
          >
            <div className="mx-auto flex max-w-[400px] flex-col gap-2.5">
              <div className="anim-rise" style={{ ["--d" as string]: "250ms" }}>
                <CandidateCard candidate={CANDIDATES[0]} onAssign={() => {}} recommended preview />
              </div>
              <div className="hidden flex-col gap-2.5 sm:flex">
                <div className="anim-rise" style={{ ["--d" as string]: "500ms" }}>
                  <CandidateRow candidateIndex={1} />
                </div>
                <div className="anim-rise" style={{ ["--d" as string]: "650ms" }}>
                  <CandidateRow candidateIndex={2} />
                </div>
              </div>
              <div className="anim-pop mt-2 flex justify-center" style={{ ["--d" as string]: "1.5s" }}>
                <ToastLine>Lucía confirmó · 20:54</ToastLine>
              </div>
            </div>
          </Paso>
        </ol>
      </section>

      <section
        aria-labelledby="oido-titulo"
        data-tone="amber"
        className="flex flex-col items-center bg-primary px-4 py-20 text-center sm:px-6 lg:py-28"
      >
        <Reveal className="flex flex-col items-center">
          <RelojDelTurno at="cubierto" />
          <h2 id="oido-titulo" className="anim-shout mt-8 font-display text-shout font-bold tracking-[-0.02em] text-ink">
            ¡Oído!
          </h2>
          <p className="mt-5 max-w-[30ch] text-xl font-medium text-ink lg:text-2xl">
            Nuestro objetivo es cubrir cada turno en menos de 10 minutos
          </p>
          <Link
            href="/register?rol=comercio"
            data-cta="oido"
            className="mt-9 inline-flex h-14 items-center justify-center rounded-[var(--radius-btn)] bg-night px-8 text-lg font-semibold text-white transition duration-200 active:scale-[0.96] hover:brightness-150"
          >
            Publicar un turno gratis
          </Link>
          <p className="mt-8 max-w-[44ch] text-caption text-ink">
            Martín, Lucía, Tu bar y los horarios de esta página son de ejemplo.
          </p>
        </Reveal>
      </section>
    </>
  );
}

/**
 * Un paso: el título y la imagen animada. Sin bajada: lo que diría la imagen
 * ya lo muestra (Julieta, 2026-10-12). Para los lectores de pantalla la
 * imagen se describe en `alt`, porque las piezas van ocultas.
 */
function Paso({ n, titulo, alt, children }: { n: number; titulo: string; alt: string; children: ReactNode }) {
  return (
    <li className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
      <Reveal className="lg:col-span-5">
        <p aria-hidden className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-primary-text">
          Paso {n}
        </p>
        <h3 className="mt-3 font-display text-headline font-semibold tracking-[-0.012em] text-ink [text-wrap:balance] lg:text-poster">
          {titulo}
        </h3>
        <p className="sr-only">{alt}</p>
      </Reveal>
      {/* Imagen del producto: piezas reales dentro de `inert` (no se pueden
          tocar ni enfocar sus links) y `aria-hidden` (la describe `alt`). */}
      <Reveal className="lg:col-span-7" delay={120}>
        <div inert aria-hidden className="no-select">
          {children}
        </div>
      </Reveal>
    </li>
  );
}

/**
 * El mapa del paso 2, como una animación corta: se publica el turno (el pin),
 * el aviso sale en ondas y a cada persona le llega cuando la onda la alcanza
 * (el retraso sale de su distancia al local). El reloj dice "Avisado a 10";
 * después tres se postulan (sus pines pasan a ámbar con su puntaje) y el
 * reloj cambia a "3 postulantes". Quieto, se ve el final.
 */
function MapaAviso() {
  return (
    <div className="mx-auto w-full max-w-[400px]">
      {/* El reloj: "Avisado a 10" mientras corre el aviso, "3 postulantes"
          al final (el primero sólo existe durante la animación). Arriba del
          mapa y no adentro, para no tapar pines. */}
      <div className="relative mb-3 h-[2.125rem]">
        <RelojDelTurno at="avisado" className="anim-out absolute left-0 top-0" style={{ ["--d" as string]: "0.4s" }} />
        <RelojDelTurno at="postulantes" className="anim-pop" style={{ ["--d" as string]: "2.6s" }} />
      </div>
    <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-[var(--mapa)]">
      <StreetGrid />
      {[0.32, 0.52, 0.72].map((r, i) => (
        <span
          key={r}
          className="anim-ring absolute rounded-full border-2 border-primary/40"
          style={{
            left: `${50 - r * 50}%`,
            top: `${50 - r * 50}%`,
            width: `${r * 100}%`,
            height: `${r * 100}%`,
            ["--d" as string]: `${500 + i * 350}ms`,
          }}
        />
      ))}
      {MAP_WORKERS.map((w) => (
        <span key={w.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${w.x}%`, top: `${w.y}%` }}>
          <span
            className="anim-pop block"
            style={{ ["--d" as string]: `${700 + Math.round(Math.hypot(w.x - 50, w.y - 50) * 30)}ms` }}
          >
            <WorkerPin inicial={w.inicial} variant="avisado" />
          </span>
          {w.candidato && (
            <span
              className="anim-pop absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
              style={{ ["--d" as string]: `${2600 + MAP_WORKERS.indexOf(w) * 350}ms` }}
            >
              <WorkerPin inicial={w.inicial} variant="candidato" rating={w.rating} />
            </span>
          )}
        </span>
      ))}
      <span className="absolute -translate-x-1/2 -translate-y-full" style={{ left: "50%", top: "50%" }}>
        <PricePin className="anim-pop" style={{ ["--d" as string]: "150ms" }} />
      </span>
      <p className="absolute bottom-3 right-4 font-mono text-metadata uppercase tracking-[0.12em] text-ink-mute">
        Ubicaciones aproximadas
      </p>
    </div>
    </div>
  );
}

/** Los otros dos postulantes en una fila corta, sin las tarjetas enteras.
 *  Mismos datos que su CandidateCard. */
function CandidateRow({ candidateIndex }: { candidateIndex: number }) {
  const c = CANDIDATES[candidateIndex];
  const nuevo = c.events_completed === 0;
  return (
    <div className="flex h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card px-3.5 shadow-[var(--shadow-soft)] ring-1 ring-line">
      <Avatar src={null} name={c.full_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-strong font-bold text-ink">{c.full_name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-ink/60">
          {nuevo ? <span>Nuevo en Oído</span> : <Rating value={c.rating} />}
          {c.distance_km != null && <span>· {formatKm(c.distance_km)}</span>}
          {!nuevo && <span>· {c.events_completed} turnos</span>}
        </div>
      </div>
      <span className="inline-flex h-9 items-center rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-ink ring-1 ring-line">
        Asignar
      </span>
    </div>
  );
}

/**
 * La frase del paso 1 se escribe sola cuando el cuadro aparece (unos 2,5 s)
 * y después se marcan las tres partes que pasan a ser campos del turno.
 * El HTML del servidor la trae entera; con "reducir movimiento", o si el
 * cuadro ya está en pantalla al cargar, queda quieta.
 */
function PedidoEscribiendose() {
  const ref = useRef<HTMLDivElement>(null);
  const [chars, setChars] = useState(PEDIDO.length);
  const [marked, setMarked] = useState(true);
  // Si la animación corre (no estaba en pantalla, sin reducir movimiento).
  const [animado, setAnimado] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setChars(0);
    setMarked(false);
    setAnimado(true);
    let tick: ReturnType<typeof setInterval> | undefined;
    let mark: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        let n = 0;
        tick = setInterval(() => {
          n += 1;
          setChars(n);
          if (n >= PEDIDO.length) {
            clearInterval(tick);
            mark = setTimeout(() => setMarked(true), 350);
          }
        }, 55);
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(tick);
      clearTimeout(mark);
    };
  }, []);

  return (
    <div ref={ref} className="w-full max-w-[420px]">
      <DescribeBox chars={chars} marked={marked} caret={chars < PEDIDO.length} />
      {/* Las tres partes marcadas, convertidas en los campos del turno. */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CAMPOS.map((c, i) => (
          <span
            key={c.k}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-ink shadow-[var(--shadow-soft)] ring-1 ring-line",
              animado && (marked ? "landing-chip" : "opacity-0")
            )}
            style={{ animationDelay: `${150 + i * 180}ms` }}
          >
            <span className="font-mono text-label uppercase tracking-[0.1em] text-ink-mute">{c.k}</span>
            <span className="font-semibold">{c.v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Lo que Oído saca de la frase (mismos valores que la tarjeta del turno). */
const CAMPOS = [
  { k: "Puesto", v: "Mozo/a" },
  { k: "Horario", v: "Hoy · 21 a 02" },
  { k: "Pago", v: "$70.000" },
];
