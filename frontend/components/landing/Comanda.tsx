"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { leerPedido } from "@/lib/pedido-natural";
import { cn } from "@/lib/cn";
import Filete from "./Filete";
import { PEDIDO, RELOJ } from "./fixtures";

/**
 * "Pedilo como lo dirías" (2026-10-18): el pedido se escribe como se habla,
 * sale impreso en una comanda y cae "¡Oído!" fileteado, lo que se contesta en
 * la cocina cuando entra una comanda. Es el momento de marca de la página:
 * banda de cielo, papel blanco, volutas y guarda de filete porteño (con el
 * "oído" del final, lo único decorado de la landing, a propósito).
 *
 * Se escribe sola cuando aparece el campo y se imprime cuando se ve el
 * ticket, apretando Pedir; al caer "¡Oído!" el papel da un golpecito. Vuelve
 * a pasar si la sección salió del todo. Si la persona toca el renglón,
 * escribe lo suyo y la comanda se imprime con eso. Lo lee
 * `lib/pedido-natural.ts`, en el navegador: es una demostración, el pedido
 * real lo lee la IA dentro de la app. Con "reducir movimiento" la comanda ya
 * está impresa.
 */
const EJEMPLO = PEDIDO;

type Comanda = { puesto: string; cuando?: string; pago?: string };

function aComanda(texto: string): Comanda | null {
  const p = leerPedido(texto);
  if (!p.puesto) return null;
  const cuando = p.dia || p.horario ? [p.dia ?? "Hoy", p.horario].filter(Boolean).join(" ") : undefined;
  return { puesto: (p.cantidad ? `${p.cantidad} × ` : "") + p.puesto, cuando, pago: p.pago };
}

function Voluta({ derecha }: { derecha?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={cn("landing-voluta", derecha && "landing-voluta-der")}>
      <path d="M5 60C5 34 19 14 41 9c12-3 19 5 15 13-4 8-16 6-14-2 1-4 6-4 6 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 44c6-10 16-13 21-11-6 4-12 9-21 11z" fill="var(--color-secondary)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 53c6-5 13-5 15-1 1 3-3 5-5 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="48" cy="20" r="2.4" fill="var(--color-primary)" />
    </svg>
  );
}

export default function Comanda() {
  const seccion = useRef<HTMLElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState(EJEMPLO);
  const [comanda, setComanda] = useState<Comanda>(() => aComanda(EJEMPLO)!);
  // "quieta": impresa desde el principio (servidor, sin JS, reducir movimiento).
  const [estado, setEstado] = useState<"quieta" | "esperando" | "imprimiendo">("quieta");
  const [vuelta, setVuelta] = useState(0);
  const [faltaPuesto, setFaltaPuesto] = useState(false);
  const [sacudir, setSacudir] = useState(0);
  // Sin texto gris mientras espera la demo; el ejemplo aparece cuando la
  // persona toma el renglón.
  const [tomado, setTomado] = useState(false);
  // El demo "aprieta" Pedir antes de imprimir.
  const [apretado, setApretado] = useState(false);
  const demo = useRef(true);

  const crecer = () => {
    const t = campo.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  };

  const imprimir = useCallback((valor: string) => {
    const c = aComanda(valor);
    if (!c) {
      setFaltaPuesto(true);
      setSacudir((n) => n + 1);
      return;
    }
    setFaltaPuesto(false);
    setComanda(c);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEstado("quieta");
      return;
    }
    setEstado("imprimiendo");
    setVuelta((n) => n + 1);
  }, []);

  // Dos disparadores (2026-10-23): la frase se escribe cuando el campo entra
  // en los dos tercios de arriba de la pantalla, y el ticket se imprime recién
  // cuando está visible a la mitad (si no, la frase espera escrita). Antes de
  // imprimir, la demo aprieta Pedir. Se repite sólo si la sección salió del
  // todo y vuelve; si la persona tomó el renglón, ya no.
  useEffect(() => {
    const el = seccion.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const campoEl = el.querySelector(".landing-campo");
    const ticketEl = el.querySelector("[data-comanda]");
    if (!campoEl || !ticketEl) return;
    let tic: ReturnType<typeof setInterval> | undefined;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let escribiendo = false;
    let escrito = false;
    let impreso = false;
    let ticketVisible = false;
    const parar = () => {
      clearInterval(tic);
      timers.forEach(clearTimeout);
      timers = [];
      escribiendo = escrito = impreso = false;
      setApretado(false);
    };
    const preparar = () => {
      setEstado("esperando");
      setTexto("");
    };
    const intentarImprimir = () => {
      if (!demo.current || !escrito || !ticketVisible || impreso) return;
      impreso = true;
      timers.push(setTimeout(() => demo.current && setApretado(true), 420));
      timers.push(
        setTimeout(() => {
          setApretado(false);
          if (demo.current) imprimir(EJEMPLO);
        }, 560)
      );
    };
    const escribir = () => {
      if (escribiendo || escrito) return;
      escribiendo = true;
      let n = 0;
      tic = setInterval(() => {
        if (!demo.current) return clearInterval(tic);
        n += 1;
        setTexto(EJEMPLO.slice(0, n));
        if (n >= EJEMPLO.length) {
          clearInterval(tic);
          escribiendo = false;
          escrito = true;
          intentarImprimir();
        }
      }, 70);
    };
    preparar();
    const ioCampo = new IntersectionObserver(
      ([e]) => {
        if (!demo.current) return ioCampo.disconnect();
        if (e.isIntersecting) escribir();
      },
      { rootMargin: "0px 0px -35% 0px" }
    );
    const ioTicket = new IntersectionObserver(
      (entradas) => {
        if (!demo.current) return ioTicket.disconnect();
        for (const e of entradas) {
          if (e.target === ticketEl) {
            ticketVisible = e.intersectionRatio >= 0.5;
            intentarImprimir();
          } else if (!e.isIntersecting) {
            // Salió del todo: la próxima vez que vuelva, se escribe de nuevo.
            parar();
            preparar();
          }
        }
      },
      { threshold: [0, 0.5] }
    );
    ioCampo.observe(campoEl);
    ioTicket.observe(ticketEl);
    ioTicket.observe(el);
    return () => {
      ioCampo.disconnect();
      ioTicket.disconnect();
      parar();
    };
  }, [imprimir]);

  useEffect(crecer, [texto]);

  const tomarControl = () => {
    setTomado(true);
    if (!demo.current) return;
    demo.current = false;
    setTexto("");
  };

  return (
    <section
      ref={seccion}
      id="como"
      aria-labelledby="comanda-titulo"
      data-tone="light"
      className={cn("landing-sec landing-cielo scroll-mt-[var(--lht)]", estado === "esperando" && "landing-espera", estado === "imprimiendo" && "landing-imprime")}
    >
      <h2 id="comanda-titulo" className="landing-h2">
        Pedilo como lo dirías
      </h2>

      <div className="mx-auto mt-[var(--aire)] w-full max-w-[640px]">
        <div key={sacudir} className={cn("landing-campo", sacudir > 0 && "landing-sacudida")}>
          <label htmlFor="pedido" className="sr-only">
            Tu pedido
          </label>
          <textarea
            ref={campo}
            id="pedido"
            rows={1}
            value={texto}
            placeholder={tomado ? EJEMPLO : undefined}
            onFocus={tomarControl}
            onChange={(e) => {
              setTexto(e.target.value);
              setFaltaPuesto(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                demo.current = false;
                imprimir(texto);
              }
            }}
          />
          <button
            type="button"
            className={cn("landing-btn landing-btn-tinta", apretado && "landing-apretado")}
            onClick={() => {
              demo.current = false;
              const valor = texto.trim() ? texto : EJEMPLO;
              if (!texto.trim()) setTexto(EJEMPLO);
              imprimir(valor);
            }}
          >
            <span className="landing-campo-pedir">Pedir</span> <span aria-hidden className="landing-btn-flecha">→</span>
          </button>
        </div>
        {faltaPuesto && (
          <p role="status" className="mt-2.5 text-sm text-ink-soft">
            Decí qué puesto necesitás: mozo, bartender, bachero…
          </p>
        )}
      </div>

      <div aria-hidden className="landing-impresora">
        <span className="landing-impresora-luz" />
        <span className="landing-impresora-ranura" />
      </div>
      <div data-comanda className="landing-comanda-marco">
        <div key={vuelta} className="landing-comanda" aria-live="polite">
          <Voluta />
          <Voluta derecha />
          <p className="landing-comanda-tope">
            <span>Comanda</span> <span>· Tu bar · {RELOJ.sinCubrir.hora}</span>
          </p>
          <div aria-hidden className="landing-orla">
            <i />
          </div>
          <dl>
            <div className="landing-comanda-fila">
              <dt>Puesto</dt>
              <dd>{comanda.puesto}</dd>
            </div>
            <div className="landing-comanda-fila">
              <dt>Cuándo</dt>
              <dd className={cn(!comanda.cuando && "landing-falta")}>{comanda.cuando ?? "A coordinar"}</dd>
            </div>
            <div className="landing-comanda-fila">
              <dt>Paga</dt>
              <dd className={cn(!comanda.pago && "landing-falta")}>{comanda.pago ?? "A coordinar"}</dd>
            </div>
          </dl>
          <div className="landing-cinta">
            <Filete palabra="¡Oído!" tam="cinta" className="landing-cinta-svg" />
          </div>
          <div aria-hidden className="landing-guarda" />
        </div>
      </div>
    </section>
  );
}
