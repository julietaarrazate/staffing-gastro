import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import { ChevronLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de Privacidad de Staffya: qué datos recopilamos, para qué los usamos y con quién los compartimos. No vendemos tus datos, nunca.",
};

const LAST_UPDATED = "Última actualización: julio 2026";

/** Bloque de sección: título + párrafos cortos, sin juridiqués. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-zinc-600">
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-[calc(100vh-57px)] bg-paper px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Nav mínima: volver + marca */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60 transition hover:text-ink"
          >
            <ChevronLeftIcon size={18} />
            Volver al inicio
          </Link>
          <Logo size={28} withWordmark={false} />
        </div>

        <div className="mt-6 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Política de Privacidad
          </h1>
          <p className="mt-1 text-sm text-ink/40">{LAST_UPDATED}</p>

          {/* Destacado: principio no-negociable, un solo acento naranja */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3.5 ring-1 ring-primary/20">
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
              Promesa
            </span>
            <p className="text-sm font-bold text-ink">
              No vendemos tus datos. Nunca.
            </p>
          </div>

          <Section title="Quién es responsable de tus datos">
            <p>
              Staffya es responsable de los datos que cargás en la app. Para
              cualquier consulta, ejercicio de derechos o reclamo sobre tus
              datos, escribinos por el chat de soporte dentro de la app.
            </p>
            {/*
              No hay un email de soporte publicado en el repo al momento de
              escribir esto (batch C2). Si en el futuro se publica uno
              (ej. soporte@staffya.com.ar), sumarlo acá. Hasta entonces, el
              canal de contacto real es el chat de la app.
            */}
          </Section>

          <Section title="Qué datos recopilamos">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Cuenta:</strong> email y nombre.
              </li>
              <li>
                <strong>Perfil:</strong> foto, zona donde te movés,
                experiencia y habilidades (posiciones en las que trabajás).
              </li>
              <li>
                <strong>Ubicación:</strong> sólo durante el check-in y
                check-out de un turno ya confirmado, para verificar que
                estuviste ahí. Nunca te seguimos en segundo plano ni fuera
                de esa ventana.
              </li>
              <li>
                <strong>Mensajes:</strong> el chat entre comercio y
                trabajador para coordinar cada turno.
              </li>
              <li>
                <strong>Suscripción:</strong> datos del plan pago del
                comercio (qué plan, desde cuándo).
              </li>
            </ul>
          </Section>

          <Section title="Para qué los usamos">
            <p>
              Para hacer funcionar el servicio: mostrar candidatos y turnos
              ordenados por cercanía y reputación, permitir el check-in/out,
              habilitar el chat y mantener la plataforma segura (detectar
              cuentas falsas o uso indebido).
            </p>
          </Section>

          <Section title="Con quién los compartimos">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                Con la otra parte de un turno (comercio o trabajador): lo
                mínimo necesario para coordinar y confirmar ese turno.
              </li>
              <li>
                Con proveedores de infraestructura que necesitamos para
                operar (hosting, base de datos, envío de emails). Nunca para
                publicidad.
              </li>
            </ul>
            <p className="font-semibold text-ink">
              Jamás vendemos tus datos a nadie, por ningún motivo.
            </p>
          </Section>

          <Section title="Tus derechos (Ley 25.326)">
            <p>
              Como usuario en Argentina, tenés derecho a acceder, rectificar,
              actualizar y suprimir tus datos personales, conforme a la Ley
              25.326 de Protección de Datos Personales. Podés ejercerlos
              escribiéndonos por el chat de la app.
            </p>
            <p>
              El órgano de control es la{" "}
              <strong>
                Agencia de Acceso a la Información Pública (AAIP)
              </strong>
              , ante quien también podés hacer reclamos.
            </p>
          </Section>

          <Section title="Dónde guardamos tu sesión">
            <p>
              Usamos <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">localStorage</code> en
              tu navegador para mantener tu sesión iniciada. No usamos
              cookies de terceros ni trackers publicitarios.
            </p>
          </Section>

          <Section title="Seguridad">
            <p>
              Tu contraseña se guarda hasheada (nunca en texto plano) y toda
              la comunicación entre tu dispositivo y nuestros servidores
              viaja cifrada.
            </p>
          </Section>

          <Section title="Retención y baja de cuenta">
            <p>
              Guardamos tus datos mientras tu cuenta esté activa. Si querés
              dar de baja tu cuenta, escribinos por el chat de la app y la
              eliminamos junto con los datos asociados, salvo lo que
              tengamos que conservar por obligación legal.
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-sm text-ink/50">
          ¿Buscabas los{" "}
          <Link href="/terminos" className="font-semibold text-primary hover:underline">
            Términos y Condiciones
          </Link>
          ?
        </p>
      </div>
    </div>
  );
}
