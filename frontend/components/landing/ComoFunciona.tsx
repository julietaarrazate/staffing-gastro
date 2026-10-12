"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CandidateCard from "@/components/CandidateCard";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { Avatar, Rating } from "@/components/ui";
import { formatKm } from "@/lib/format";
import { CANDIDATES, MAP_WORKERS, PEDIDO } from "./fixtures";
import RelojDelTurno from "./RelojDelTurno";
import { DescribeBox, PricePin, StreetGrid, WorkerPin } from "./replicas";
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
            texto={
              <>
                Escribí &ldquo;Necesito un mozo hoy de 21 a 2, pago 70.000&rdquo;. Oído arma el turno y lo revisás
                antes de publicar.
              </>
            }
          >
            <div className="flex flex-col items-center gap-4">
              <PedidoEscribiendose />
              {/* En el celular alcanza con la frase: la tarjeta sola suma media
                  pantalla y el paso 3 ya muestra cómo se ve un turno. */}
              <div className="hidden h-[285px] w-[240px] lg:block">
                <div className="h-[380px] w-[320px] origin-top-left scale-[0.75]">
                  <OpportunityCard shift={shift} preview />
                </div>
              </div>
            </div>
          </Paso>
          <Paso
            n={2}
            titulo="Le llega a quien está cerca"
            texto="Avisamos primero a los 10 más indicados por cercanía, reputación y puntualidad. Si en 8 minutos nadie lo toma, pasa a urgente y le llega a más gente."
          >
            <div className="relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-[1.75rem] bg-[var(--mapa)]">
              <StreetGrid />
              {/* Al entrar: se publica el turno (el pin), el aviso sale en
                  ondas y a cada persona le llega cuando la onda la alcanza
                  (el retraso sale de su distancia al local). */}
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
                </span>
              ))}
              <span className="absolute -translate-x-1/2 -translate-y-full" style={{ left: "50%", top: "50%" }}>
                <PricePin className="anim-pop" style={{ ["--d" as string]: "150ms" }} />
              </span>
              <p className="absolute bottom-3 right-4 font-mono text-metadata uppercase tracking-[0.12em] text-ink-mute">
                Ubicaciones aproximadas
              </p>
            </div>
          </Paso>
          <Paso
            n={3}
            titulo="Elegís y te confirma"
            texto="Ves por qué cada persona es buena opción. La asignás, te confirma desde su celular y la ves llegar."
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

function Paso({ n, titulo, texto, children }: { n: number; titulo: string; texto: ReactNode; children: ReactNode }) {
  return (
    <li className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
      <Reveal className="lg:col-span-5">
        <p aria-hidden className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-primary-text">
          Paso {n}
        </p>
        <h3 className="mt-3 font-display text-headline font-semibold tracking-[-0.012em] text-ink [text-wrap:balance]">
          {titulo}
        </h3>
        <p className="mt-4 max-w-[40ch] text-lg leading-[1.5] text-ink-soft">{texto}</p>
      </Reveal>
      {/* Imagen del producto: piezas reales dentro de `inert` (no se pueden
          tocar ni enfocar sus links) y `aria-hidden` (el texto de al lado ya
          dice lo mismo). */}
      <Reveal className="lg:col-span-7" delay={120}>
        <div inert aria-hidden className="no-select">
          {children}
        </div>
      </Reveal>
    </li>
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

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setChars(0);
    setMarked(false);
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
    </div>
  );
}
