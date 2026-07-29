import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import { ChevronLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos y Condiciones de uso de Oído: qué es la plataforma, cuentas, publicación y postulación a turnos, reputación, suscripciones y más.",
};

const LAST_UPDATED = "Última actualización: julio 2026";

/** Bloque de sección: título + párrafos cortos, sin juridiqués. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink/60">
        {children}
      </div>
    </section>
  );
}

export default function TerminosPage() {
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
            Términos y Condiciones
          </h1>
          <p className="mt-1 text-sm text-ink/40">{LAST_UPDATED}</p>

          <Section title="Qué es Oído">
            <p>
              Oído es una plataforma de intermediación: conecta comercios
              gastronómicos que necesitan cubrir turnos con trabajadores que
              quieren tomarlos. Ahí termina nuestro rol.
            </p>
            <p>
              Oído <strong>no es tu empleador</strong> ni el de nadie, y{" "}
              <strong>no es parte</strong> de la relación laboral o comercial
              que se arma entre el comercio y el trabajador. Tampoco
              garantizamos que un turno publicado se cubra, ni que un turno
              tomado se concrete tal cual se pactó: eso depende de las dos
              partes.
            </p>
          </Section>

          <Section title="Tu cuenta">
            <p>
              Para usar Oído tenés que ser mayor de 18 años y cargar datos
              reales tuyos o de tu comercio: nombre, contacto y lo que te
              pidamos en el perfil. Nada de datos inventados.
            </p>
            <p>Cada persona tiene una sola cuenta. Nada de cuentas duplicadas.</p>
          </Section>

          <Section title="Publicar y postularse a turnos">
            <p>
              El comercio define las condiciones del turno (posición,
              horario, paga, vestimenta) y le paga directamente al
              trabajador — Oído no procesa ni retiene esos pagos.
            </p>
            <p>
              El trabajador decide libremente si se postula o no a cada
              turno. Nadie está obligado a aceptar uno que no le cierra.
            </p>
          </Section>

          <Section title="Cancelaciones y no-show">
            <p>
              Si aceptaste un turno y no te presentás sin avisar (no-show), o
              cancelás muy sobre la hora, eso queda reflejado en tu
              reputación dentro de la app. Lo mismo si un comercio cancela un
              turno ya confirmado sin previo aviso razonable.
            </p>
          </Section>

          <Section title="Reputación y reseñas">
            <p>
              Comercios y trabajadores se califican entre sí después de cada
              turno. Las reseñas tienen que ser honestas y basadas en la
              experiencia real: nada de reseñas armadas, compradas o en
              banda para inflar o hundir un perfil.
            </p>
            <p>
              Si detectamos contenido falso, ofensivo o manipulado, podemos
              removerlo.
            </p>
          </Section>

          <Section title="Suscripciones del comercio">
            <p>
              Los comercios acceden a planes pagos con precios visibles
              dentro de la app. Se renuevan mes a mes de forma automática.
            </p>
            <p>
              Podés dar de baja tu suscripción cuando quieras; sigue activa
              hasta el final del período ya pagado, sin renovarse después.
            </p>
          </Section>

          <Section title="Conducta prohibida">
            <p>No están permitidas, entre otras, estas conductas:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Cargar datos falsos sobre vos, tu identidad o tu comercio.</li>
              <li>
                Discriminar por género, edad, origen, religión, discapacidad
                u otra condición.
              </li>
              <li>Acosar, amenazar o maltratar a otro usuario.</li>
              <li>
                Usar Oído para contactar a la otra parte y después mover
                todo por fuera de la plataforma con el único fin de evadir
                sus reglas (reputación, seguridad, comisiones, etc.).
              </li>
            </ul>
            <p>
              El incumplimiento puede derivar en suspensión o baja de la
              cuenta.
            </p>
          </Section>

          <Section title="Límite de responsabilidad">
            <p>
              Oído pone la infraestructura para conectar comercios y
              trabajadores, pero no responde por lo que pase durante el
              turno en sí: cumplimiento de horarios, condiciones de trabajo,
              pagos acordados o conflictos entre las partes. Esas
              obligaciones son entre comercio y trabajador.
            </p>
          </Section>

          <Section title="Cambios en estos términos">
            <p>
              Podemos actualizar estos Términos con el tiempo. Si hacemos un
              cambio importante, te avisamos dentro de la app. Seguir usando
              Oído después de un aviso implica que aceptás la versión
              nueva.
            </p>
          </Section>

          <Section title="Ley aplicable y jurisdicción">
            <p>
              Estos Términos se rigen por las leyes de la República
              Argentina. Ante cualquier conflicto, son competentes los
              tribunales ordinarios argentinos.
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-sm text-ink/50">
          ¿Buscabas la{" "}
          <Link href="/privacidad" className="font-semibold text-primary-text hover:underline">
            Política de Privacidad
          </Link>
          ?
        </p>
      </div>
    </div>
  );
}
