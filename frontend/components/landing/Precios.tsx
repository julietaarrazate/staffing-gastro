"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatArs } from "@/lib/format";
import { planValido, urlAltaConPlan } from "@/lib/plan-elegido";
import type { SubscriptionPlan } from "@/lib/types";
import { RESPALDO } from "./planes";
import Reveal from "./Reveal";

/**
 * PRECIOS. Responde "¿cuánto sale?" una vez que se entendió qué hace.
 *
 * Desde el 2026-11-18 los planes son **la carta de un bodegón** (decisión de
 * Julieta sobre la prueba híbrida, docs/design-system/direccion-relieve.md):
 * una hoja de papel con doble filete azul hondo, cada plan como un plato
 * (el nombre en brocha, el precio y lo que trae), «sugerencia de la casa»
 * anotado a mano en el Básico y «No cobramos cubierto» al pie. Al lado, una
 * pizarra donde la tiza escribe el plan elegido y marca el tope de turnos
 * con palitos de a cinco. Los platos son botones que eligen; el camino al
 * alta es uno solo, «Empezar con <plan>», debajo de la pizarra.
 *
 * Qué no cambió: los planes, los precios y a dónde lleva el botón
 * (`/register?rol=comercio&plan=<code>`, ver `lib/plan-elegido.ts`; al
 * terminar la bienvenida el comercio cae en "Mi plan" con ese plan
 * resaltado). Siempre al alta, aunque haya sesión: con sesión esta página no
 * se muestra (`LandingGate` manda a la home del rol).
 *
 * Antes (2026-10-09 a 2026-11-18) eran tres tarjetas con el tope dibujado en
 * cuadraditos y un botón cada una. La carta con puntos guía de antes de eso
 * se veía "muy básica" (Julieta); ésta vuelve a ser una carta, pero es un
 * objeto del oficio y no una lista.
 *
 * El HTML del servidor trae `RESPALDO` (planes.ts) con el Básico elegido y la
 * pizarra ya escrita; después se pide GET /subscription/plans/public y, si
 * responde bien, gana la API (una sola fuente de verdad). Con el backend de
 * Render dormido la sección igual está, y "/#precios" cae donde debe.
 */

/** El plan que la casa sugiere y el que sale elegido. */
const SUGERIDO = "basico";
/** Más grupos de cinco que éstos no entran en la pizarra: siguen con puntos. */
const GRUPOS_MAX = 6;

type Trazo = { d: string; k: number };

/**
 * Los palitos de la pizarra: cuatro derechos y uno cruzado por cada cinco
 * turnos, más los sueltos. Sin tope (Pro) son cuatro grupos y tres puntos:
 * «y sigue». Los palitos van apenas torcidos, como hechos a mano; la cuenta
 * es fija (no hay azar) para que el servidor y el navegador dibujen lo mismo.
 */
function palitos(max: number | null) {
  const sinTope = max === null;
  const enteros = sinTope ? 4 : Math.floor(max / 5);
  const grupos = Math.min(enteros, GRUPOS_MAX);
  const sueltos = sinTope || enteros > GRUPOS_MAX ? 0 : max % 5;
  const sigue = sinTope || enteros > GRUPOS_MAX;
  const trazos: Trazo[] = [];
  const palito = (x0: number, g: number, n: number) => {
    const x = x0 + n * 13 + (n % 2 ? 1.5 : -1);
    trazos.push({ k: trazos.length, d: `M${x} ${6 + (n % 2) * 2}L${x + (((n + g) % 3) - 1) * 1.5} ${42 - (n % 2) * 2}` });
  };
  for (let g = 0; g < grupos; g++) {
    const x0 = g * 74 + 8;
    for (let n = 0; n < 4; n++) palito(x0, g, n);
    trazos.push({ k: trazos.length, d: `M${x0 - 6} 36L${x0 + 50} 10` });
  }
  for (let n = 0; n < sueltos; n++) palito(grupos * 74 + 8, grupos, n);
  const finPalitos = grupos * 74 + (sueltos ? sueltos * 13 + 10 : 0);
  const puntos = sigue ? [0, 1, 2].map((n) => ({ k: trazos.length + n, cx: finPalitos + 12 + n * 13 })) : [];
  return { trazos, puntos, ancho: Math.max(finPalitos + (sigue ? 46 : 0), 20), pasos: trazos.length + puntos.length };
}

/** El óvalo a mano que rodea el precio del plato elegido. */
function Ovalo() {
  return (
    <svg aria-hidden className="landing-ovalo" viewBox="0 0 100 60" preserveAspectRatio="none">
      <path d="M52 5C80 3 97 14 96 31C95 49 72 57 46 56C19 55 3 45 4 28C5 11 28 4 60 7" />
    </svg>
  );
}

const demora = (segundos: number) => ({ "--t": `${segundos.toFixed(2)}s` }) as CSSProperties;

export default function Precios() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(RESPALDO);
  const [elegido, setElegido] = useState<string>(SUGERIDO);
  // La pizarra sale escrita y quieta del servidor. La tiza la escribe la
  // primera vez que entra en pantalla y cada vez que se elige un plato.
  const [escribe, setEscribe] = useState(false);
  const pizarra = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ plans: SubscriptionPlan[] }>("/subscription/plans/public")
      .then((res) => {
        if (alive && Array.isArray(res?.plans) && res.plans.length > 0) setPlans(res.plans);
      })
      .catch(() => {
        // Se queda el respaldo: en la landing no se muestra un error de red.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = pizarra.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setEscribe(true);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Si la API trae otros códigos, el elegido es el sugerido o el primero.
  const plan = plans.find((p) => p.code === elegido) ?? plans.find((p) => p.code === SUGERIDO) ?? plans[0];
  // Un código que no conocemos (un plan nuevo en la API antes que en el
  // front) igual lleva al alta de comercio, sin plan.
  const conocido = planValido(plan.code);
  const tope = palitos(plan.max_turnos_mes);
  // Los renglones de abajo esperan a que terminen los palitos.
  const t3 = 0.8 + tope.pasos * 0.07;

  return (
    <section id="precios" aria-labelledby="precios-titulo" data-tone="light" className="landing-sec landing-plano scroll-mt-[var(--lht)]">
      <h2 id="precios-titulo" className="landing-h2 max-w-[14ch]">
        Sin comisión por turno
      </h2>

      <Reveal className="landing-carta-grid">
        <div className="landing-carta">
          <div className="landing-carta-dentro">
            <p className="landing-carta-cab">La carta · planes para el local</p>
            <ul>
              {plans.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    className="landing-plato"
                    aria-pressed={p.code === plan.code}
                    onClick={() => {
                      setElegido(p.code);
                      setEscribe(true);
                    }}
                  >
                    <span className="landing-plato-nombre">
                      {p.name}
                      {p.code === SUGERIDO && <span className="landing-plato-casa">sugerencia de la casa</span>}
                    </span>
                    <span className="landing-plato-precio">
                      {formatArs(p.price_ars)} <small>por mes</small>
                      <Ovalo />
                    </span>
                    <span className="landing-plato-detalle">{p.features.join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="landing-carta-pie">No cobramos cubierto. Tampoco comisión por turno.</p>
          </div>
        </div>

        <div className="landing-cuenta">
          {/* `aria-live`: al elegir un plato, el lector de pantalla dice lo
              que quedó escrito. Lo de adentro lleva `key` para que la tiza
              vuelva a escribir con cada plan. */}
          <div ref={pizarra} aria-live="polite" className={cn("landing-pizarra", escribe && "landing-escribe")}>
            <div key={plan.code} className="contents">
              <p className="landing-tiza landing-tiza-chica" style={demora(0)}>
                Hoy marcha
              </p>
              <p className="landing-tiza landing-tiza-nombre" style={demora(0.25)}>
                {plan.name}
              </p>
              <svg aria-hidden className="landing-palitos" viewBox={`0 0 ${tope.ancho} 48`} style={{ width: tope.ancho }}>
                {tope.trazos.map((t) => (
                  <path key={t.k} d={t.d} style={{ "--k": t.k } as CSSProperties} />
                ))}
                {tope.puntos.map((c) => (
                  <circle key={c.k} cx={c.cx} cy={34} r={3} style={{ "--k": c.k } as CSSProperties} />
                ))}
              </svg>
              <p className="landing-tiza" style={demora(t3)}>
                {plan.max_turnos_mes === null ? "turnos sin tope" : `hasta ${plan.max_turnos_mes} turnos por mes`}
              </p>
              <p className="landing-tiza landing-tiza-precio" style={demora(t3 + 0.35)}>
                {formatArs(plan.price_ars)} <small>por mes</small>
              </p>
              <p className="landing-tiza landing-tiza-chica" style={demora(t3 + 0.7)}>
                comisión por turno: $0
              </p>
            </div>
          </div>
          <Link
            href={conocido ? urlAltaConPlan(conocido) : "/register?rol=comercio"}
            data-cta={`precios-${plan.code}`}
            className="landing-btn landing-btn-primario"
          >
            Empezar con {plan.name} <span aria-hidden className="landing-btn-flecha">→</span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
