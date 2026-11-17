"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { borrarSesion, guardarSesion, leerSesion } from "@/lib/almacen-sesion";
import { useIdempotencyKeys } from "@/lib/idempotency";
import {
  ABSENCE_OUTCOMES,
  AYUDAS,
  CHANNELS,
  EVENTUAL_RANGES,
  LOCAL_KINDS,
  PASOS,
  PRICING_PREFERENCES,
  RESPUESTAS_VACIAS,
  ROLES,
  TEAM_MODELS,
  TITULOS,
  armarPedido,
  faltaEnPaso,
  limpiarRef,
  type Respuestas,
} from "@/lib/encuesta";
import { Button, TextField } from "@/components/ui";
import PesosInput from "@/components/ui/PesosInput";
import { OpcionMultiple, OpcionUnica } from "./Opciones";

const BORRADOR = "oido:encuesta";
const CLASE_CIELO = "encuesta-cielo";

interface Borrador {
  indice: number;
  respuestas: Respuestas;
}

/**
 * La encuesta para locales (`/encuesta`, ADR-0025): una pregunta por pantalla,
 * pensada para el celular y para abrirse desde un link de WhatsApp, sin
 * sesión. Lo que se contesta se guarda en la pestaña hasta enviar (un toque
 * al «atrás» del teléfono no lo pierde).
 */
export default function EncuestaForm({ refParam }: { refParam: string | null }) {
  const [indice, setIndice] = useState(0);
  const [r, setR] = useState<Respuestas>(RESPUESTAS_VACIAS);
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminada, setTerminada] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);
  const montada = useRef(false);
  const { keyFor, clear } = useIdempotencyKeys();
  const source = useMemo(() => limpiarRef(refParam), [refParam]);

  // Recupera lo contestado si la persona recargó o volvió a la pestaña.
  useEffect(() => {
    const guardado = leerSesion<Borrador>(BORRADOR);
    if (guardado && guardado.indice >= 0 && guardado.indice < PASOS.length) {
      setIndice(guardado.indice);
      setR({ ...RESPUESTAS_VACIAS, ...guardado.respuestas });
    }
  }, []);

  useEffect(() => {
    if (terminada) return;
    if (!montada.current) {
      montada.current = true;
      return;
    }
    guardarSesion(BORRADOR, { indice, respuestas: r } satisfies Borrador);
  }, [indice, r, terminada]);

  // Cada pantalla nueva arranca en su pregunta: el foco va al título (para
  // quien usa lector de pantalla) y la página vuelve arriba.
  useEffect(() => {
    if (!montada.current) return;
    titulo.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [indice, terminada]);

  // Un aviso que queda detrás de la barra de abajo no se ve: se trae a la vista.
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (intento || error) aviso.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [intento, error]);

  const paso = PASOS[indice];
  const ultimo = indice === PASOS.length - 1;
  const falta = faltaEnPaso(paso, r);
  const set = <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) => {
    setR((actual) => ({ ...actual, [clave]: valor }));
    setError(null);
  };

  const siguiente = async () => {
    if (falta) {
      setIntento(true);
      return;
    }
    setIntento(false);
    if (!ultimo) {
      setIndice(indice + 1);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api.post("/encuesta", armarPedido(r, source, honeypot), null, 20_000, keyFor("enviar"));
      clear("enviar");
      borrarSesion(BORRADOR);
      setTerminada(true);
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos enviar tus respuestas. Probá de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  const atras = () => {
    setIntento(false);
    setError(null);
    setIndice(Math.max(0, indice - 1));
  };

  if (terminada) return <Gracias quiereBeta={r.wantsBeta} tituloRef={titulo} />;

  return (
    <div data-landing className="flex min-h-dvh flex-col bg-background">
      <header data-theme="light" className={CLASE_CIELO}>
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Oído, inicio" className="landing-marca">
            oído
          </Link>
          <p className="font-mono text-xs font-medium uppercase tracking-wide text-ink">
            {indice + 1} de {PASOS.length}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Avance de la encuesta"
          aria-valuemin={1}
          aria-valuemax={PASOS.length}
          aria-valuenow={indice + 1}
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-card/60"
        >
          <div
            className="h-full rounded-full bg-primary-text transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((indice + 1) / PASOS.length) * 100}%` }}
          />
        </div>
        <h1
          ref={titulo}
          tabIndex={-1}
          className="font-display mt-7 text-[clamp(1.6rem,6.4vw,2.4rem)] leading-[1.1] tracking-[-0.03em] text-ink outline-none"
        >
          {TITULOS[paso]}
        </h1>
        {AYUDAS[paso] && <p className="mt-2.5 text-sm text-ink/70">{AYUDAS[paso]}</p>}
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-6">
        <Pregunta paso={paso} r={r} set={set} />
        {/* Honeypot: un campo que una persona no ve ni toca; un robot lo llena. */}
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <div ref={aviso} className="scroll-mb-28">
          {intento && falta && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger-text">
              {falta}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger-text">
              {error}
            </p>
          )}
        </div>
      </main>

      <footer className="safe-bottom sticky bottom-0 border-t border-line bg-chrome backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl gap-3 px-4 py-3">
          {indice > 0 && (
            <Button variant="surface" size="lg" onClick={atras} disabled={enviando}>
              Atrás
            </Button>
          )}
          <Button size="lg" fullWidth onClick={siguiente} loading={enviando} className="flex-1">
            {ultimo ? "Enviar respuestas" : "Siguiente"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Pregunta({
  paso,
  r,
  set,
}: {
  paso: (typeof PASOS)[number];
  r: Respuestas;
  set: <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) => void;
}) {
  switch (paso) {
    case "tipo":
      return (
        <OpcionUnica
          nombre={TITULOS.tipo}
          opciones={LOCAL_KINDS}
          valor={r.localKind}
          onChange={(v) => set("localKind", v)}
        />
      );
    case "barrio":
      return (
        <TextField
          label="Barrio"
          name="barrio"
          value={r.barrio}
          onChange={(v) => set("barrio", v)}
          placeholder="Palermo, Caballito, Microcentro…"
          maxLength={80}
          autoComplete="off"
        />
      );
    case "equipo":
      return (
        <OpcionUnica
          nombre={TITULOS.equipo}
          opciones={TEAM_MODELS}
          valor={r.teamModel}
          onChange={(v) => set("teamModel", v)}
        />
      );
    case "mes_normal":
      return (
        <OpcionUnica
          nombre={TITULOS.mes_normal}
          opciones={EVENTUAL_RANGES}
          valor={r.eventualsNormal}
          onChange={(v) => set("eventualsNormal", v)}
        />
      );
    case "mes_fuerte":
      return (
        <OpcionUnica
          nombre={TITULOS.mes_fuerte}
          opciones={EVENTUAL_RANGES}
          valor={r.eventualsPeak}
          onChange={(v) => set("eventualsPeak", v)}
        />
      );
    case "puestos":
      return (
        <OpcionMultiple
          nombre={TITULOS.puestos}
          opciones={ROLES}
          valores={r.roles}
          onChange={(v) => set("roles", v)}
        />
      );
    case "canales":
      return (
        <OpcionMultiple
          nombre={TITULOS.canales}
          opciones={CHANNELS}
          valores={r.channels}
          onChange={(v) => set("channels", v)}
        />
      );
    case "ausencia":
      return (
        <OpcionMultiple
          nombre={TITULOS.ausencia}
          opciones={ABSENCE_OUTCOMES}
          valores={r.absence}
          onChange={(v) => set("absence", v)}
        />
      );
    case "pago":
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/70">Pesos por persona</span>
          <PesosInput
            value={r.pago}
            onChange={(v) => set("pago", v)}
            placeholder="Por ejemplo, 40.000"
            aria-label="Pesos por persona, por una jornada de 8 horas"
            className="min-h-[48px] w-full rounded-[var(--radius-input)] bg-surface px-4 text-body text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40"
          />
        </label>
      );
    case "precio":
      return (
        <OpcionUnica
          nombre={TITULOS.precio}
          opciones={PRICING_PREFERENCES}
          valor={r.pricing}
          onChange={(v) => set("pricing", v)}
        />
      );
    case "contacto":
      return <Contacto r={r} set={set} />;
  }
}

function Contacto({
  r,
  set,
}: {
  r: Respuestas;
  set: <K extends keyof Respuestas>(clave: K, valor: Respuestas[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-btn)] bg-card px-4 py-3 text-base font-semibold text-ink ring-1 ring-line">
        <input
          type="checkbox"
          checked={r.wantsBeta}
          onChange={(e) => set("wantsBeta", e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[var(--color-primary-text)]"
        />
        <span>Quiero sumarme a la beta</span>
      </label>
      <TextField
        label="Tu nombre"
        name="name"
        autoComplete="name"
        value={r.contactName}
        onChange={(v) => set("contactName", v)}
        maxLength={120}
      />
      <TextField
        label="Nombre del local"
        name="organization"
        autoComplete="organization"
        value={r.businessName}
        onChange={(v) => set("businessName", v)}
        maxLength={160}
      />
      <TextField
        label="Teléfono"
        name="tel"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={r.phone}
        onChange={(v) => set("phone", v)}
        maxLength={40}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={r.email}
        onChange={(v) => set("email", v)}
        maxLength={200}
      />
      <label className="flex items-start gap-3 text-sm text-ink/75">
        <input
          type="checkbox"
          checked={r.consent}
          onChange={(e) => set("consent", e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary-text)]"
        />
        <span>
          Acepto que Oído guarde estos datos para escribirme sobre la beta. Los borramos a los 12
          meses. Mirá la{" "}
          <Link
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-text underline underline-offset-2"
          >
            política de privacidad
          </Link>
          .
        </span>
      </label>
    </div>
  );
}

function Gracias({
  quiereBeta,
  tituloRef,
}: {
  quiereBeta: boolean;
  tituloRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div data-landing className="flex min-h-dvh flex-col bg-background">
      <header data-theme="light" className={`${CLASE_CIELO} pb-14`}>
        <Link href="/" aria-label="Oído, inicio" className="landing-marca">
          oído
        </Link>
        <h1
          ref={tituloRef}
          tabIndex={-1}
          className="font-display mt-16 text-[clamp(2.4rem,11vw,4rem)] leading-[1.05] tracking-[-0.04em] text-ink outline-none"
        >
          ¡Gracias!
        </h1>
        <p className="mt-4 max-w-[28ch] text-lg leading-snug text-ink/80">
          {quiereBeta
            ? "Te vamos a escribir apenas abramos la beta."
            : "Tus respuestas nos ayudan a armar Oído para los locales."}
        </p>
        <Link
          href="/"
          className="landing-btn landing-btn-borde mt-10"
          style={{ height: 48 }}
        >
          Conocer Oído
        </Link>
      </header>
    </div>
  );
}
