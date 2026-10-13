"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CandidateCard from "@/components/CandidateCard";
import { Avatar, Rating } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CheckCircleIcon, ClockIcon, UsersIcon } from "@/components/icons";
import { formatKm } from "@/lib/format";
import { CANDIDATES, MAP_WORKERS, PEDIDO } from "./fixtures";
import RelojDelTurno from "./RelojDelTurno";
import { DescribeBox, PricePin, StreetGrid, ToastLine, WorkerPin } from "./replicas";
import Reveal from "./Reveal";

/**
 * Cómo funciona, en tres pasos con su título (`h3`) fijo y una imagen quieta
 * del producto al lado. Los números son los del producto: el aviso a los 10
 * más indicados (`NEARBY_NOTIFICATION_LIMIT`) y la ampliación a los 8 minutos
 * (`ESCALATION_DELAY`), los dos en backend/app/modules/shift/application/
 * services.py. Cierra con la banda "¡Oído!", el único momento de marca.
 */
export default function ComoFunciona() {

  return (
    <>
      <section
        id="como-funciona"
        aria-labelledby="como-funciona-titulo"
        data-tone="light"
        className="scroll-mt-[var(--lht)] px-4 py-14 sm:px-6 lg:px-12 lg:py-20"
      >
        <h2
          id="como-funciona-titulo"
          className="font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          Así se cubre un turno
        </h2>
        {/* El turno de Martín, que recorre los tres pasos hasta quedar
            cubierto (paso 2: avisado → postulantes; paso 3: cubierto). */}
        <RelojDelTurno at="sinCubrir" className="mt-5" />
        <ol className="mt-12 flex flex-col gap-16 lg:mt-16 lg:gap-24">
          <Paso
            n={1}
            titulo="Pedí lo que necesitás"
            alt="Escribís “Necesito un mozo hoy de 21 a 2, pago 70.000”, tocás Completar y Oído arma el turno con puesto, horario y pago."
          >
            <PedidoEscribiendose />
          </Paso>
          <Paso
            n={2}
            titulo="Buscamos quién lo cubra, cerca tuyo"
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
              {/* El ticket termina acá: de "3 postulantes" a "cubierto". */}
              <div className="relative mb-1 h-[2.125rem]">
                <RelojDelTurno at="postulantes" className="anim-out absolute left-0 top-0" style={{ ["--d" as string]: "0s" }} />
                <RelojDelTurno at="cubierto" className="anim-pop" style={{ ["--d" as string]: "2.9s" }} />
              </div>
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
              <div className="anim-pop mt-2 flex justify-center" style={{ ["--d" as string]: "3.1s" }}>
                <ToastLine>Lucía confirmó · 20:54</ToastLine>
              </div>
            </div>
          </Paso>
        </ol>
      </section>

      <section
        aria-labelledby="oido-titulo"
        data-tone="amber"
        className="flex flex-col items-center bg-primary px-4 py-14 text-center sm:px-6 lg:py-20"
      >
        <Reveal className="flex flex-col items-center">
          <RelojDelTurno at="cubierto" />
          <h2 id="oido-titulo" className="anim-shout mt-8 font-display text-shout font-bold tracking-[-0.02em] text-ink">
            ¡Oído!
          </h2>
          {/* Lo que resolvió, no qué significa la palabra: la gente de
              gastronomía ya lo sabe (Julieta, 2026-10-13). */}
          <p className="mt-5 max-w-[28ch] text-xl font-medium text-ink [text-wrap:balance] lg:text-2xl">
            Turno cubierto en 8 minutos, sin llamar a nadie ni pedir en grupos de WhatsApp
          </p>
          <Link
            href="/register?rol=comercio"
            data-cta="oido"
            className="mt-9 inline-flex h-14 items-center justify-center rounded-[var(--radius-btn)] bg-night px-8 text-lg font-semibold text-white transition duration-200 active:scale-[0.96] hover:brightness-150"
          >
            Publicar mi primer turno gratis
          </Link>
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
      {/* Un escalón más chico que "Así se cubre un turno" y con su número en
          un círculo: antes los dos títulos tenían el mismo tamaño y se leían
          como dos bloques iguales pegados (Julieta, 2026-10-13). */}
      <Reveal className="flex items-center gap-4 lg:col-span-5">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-mono text-body-strong font-medium text-night shadow-[var(--shadow-primary)]"
        >
          {n}
        </span>
        <div>
          <h3 className="font-display text-h1 font-semibold tracking-[-0.01em] text-ink [text-wrap:balance] lg:text-display">
            {titulo}
          </h3>
          <p className="sr-only">{alt}</p>
        </div>
      </Reveal>
      {/* Imagen del producto: piezas reales dentro de `inert` (no se pueden
          tocar ni enfocar sus links) y `aria-hidden` (la describe `alt`). */}
      {/* Arranca cuando la imagen ya entró un quinto en pantalla: antes
          (un tercio) quedaba un hueco en blanco abajo de cada título. */}
      <Reveal className="lg:col-span-7" delay={150} margen="0px 0px -20% 0px">
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
        <RelojDelTurno at="avisado" className="anim-out absolute left-0 top-0" style={{ ["--d" as string]: "0.9s" }} />
        <RelojDelTurno at="postulantes" className="anim-pop" style={{ ["--d" as string]: "4.2s" }} />
      </div>
    <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-[var(--mapa)] shadow-[var(--shadow-float)] ring-1 ring-line">
      {/* Las calles aparecen en un círculo que crece desde el local, como en
          la historia original. */}
      <div className="anim-reveal absolute inset-0">
        <StreetGrid />
      </div>
      {[0.32, 0.52, 0.72].map((r, i) => (
        <span
          key={r}
          className="anim-ring absolute rounded-full border-2 border-primary/40"
          style={{
            left: `${50 - r * 50}%`,
            top: `${50 - r * 50}%`,
            width: `${r * 100}%`,
            height: `${r * 100}%`,
            ["--d" as string]: `${900 + i * 450}ms`,
          }}
        />
      ))}
      {MAP_WORKERS.map((w) => (
        <span key={w.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${w.x}%`, top: `${w.y}%` }}>
          <span
            className="anim-pop block"
            style={{ ["--d" as string]: `${1300 + Math.round(Math.hypot(w.x - 50, w.y - 50) * 40)}ms` }}
          >
            <WorkerPin inicial={w.inicial} variant="avisado" />
          </span>
          {w.candidato && (
            <span
              className="anim-pop absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
              style={{ ["--d" as string]: `${4200 + MAP_WORKERS.indexOf(w) * 450}ms` }}
            >
              <WorkerPin inicial={w.inicial} variant="candidato" rating={w.rating} />
            </span>
          )}
        </span>
      ))}
      <span className="absolute -translate-x-1/2 -translate-y-full" style={{ left: "50%", top: "50%" }}>
        <PricePin className="anim-drop" style={{ ["--d" as string]: "500ms" }} />
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
 * El cuadro "Describilo" del paso 1, como en la historia original pero por
 * tiempo: la frase se escribe con el cursor, se marcan las tres partes que
 * pasan a ser campos, se aprieta "Completar", aparece "Leyendo tu pedido…" y
 * sale el turno armado en tres datos. Hasta el 2026-10-13 salía la tarjeta
 * entera del turno: tardaba y alargaba el paso (Julieta), y lo que cuenta ya
 * está en los tres datos. Unos 5 s en total.
 *
 * El HTML del servidor trae el final (frase entera y turno armado); con "reducir
 * movimiento", o si el cuadro ya está en pantalla al cargar, queda quieto.
 */
type Fase = "quieto" | "esperando" | "escribiendo" | "marcado" | "apretado" | "leyendo" | "listo";

function PedidoEscribiendose() {
  const ref = useRef<HTMLDivElement>(null);
  const [chars, setChars] = useState(PEDIDO.length);
  const [fase, setFase] = useState<Fase>("quieto");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setChars(0);
    setFase("esperando");
    const timers: ReturnType<typeof setTimeout>[] = [];
    let tick: ReturnType<typeof setInterval> | undefined;
    const despues = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setFase("escribiendo");
        let n = 0;
        tick = setInterval(() => {
          n += 1;
          setChars(n);
          if (n < PEDIDO.length) return;
          clearInterval(tick);
          despues(450, () => setFase("marcado"));
          despues(1200, () => setFase("apretado"));
          despues(1500, () => setFase("leyendo"));
          despues(2500, () => setFase("listo"));
        }, 60);
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, []);

  const marcado = fase === "quieto" || fase === "marcado" || fase === "apretado" || fase === "leyendo" || fase === "listo";
  const tarjeta = fase === "quieto" || fase === "listo";

  return (
    <div ref={ref} className="flex flex-col items-center gap-5">
      <DescribeBox
        className="w-full max-w-[420px]"
        chars={chars}
        marked={marcado}
        caret={fase === "esperando" || fase === "escribiendo"}
        pressed={fase === "apretado"}
        loading={fase === "leyendo"}
      />
      {/* El turno que arma Oído: puesto, horario y pago, ya como campos. */}
      <div
        className={cn(
          "flex w-full max-w-[420px] flex-col gap-2.5 transition duration-500 ease-[cubic-bezier(.2,.8,.2,1)]",
          tarjeta ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary-text">
          <CheckCircleIcon size={16} /> Turno listo para publicar
        </p>
        <div className="flex flex-wrap gap-2">
          <Dato icono={<UsersIcon size={15} />}>Mozo/a</Dato>
          <Dato icono={<ClockIcon size={15} />}>Hoy 21:00 – 02:00</Dato>
          <Dato>$70.000</Dato>
        </div>
      </div>
    </div>
  );
}

function Dato({ icono, children }: { icono?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-line">
      {icono}
      {children}
    </span>
  );
}
