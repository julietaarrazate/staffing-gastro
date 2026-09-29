import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import { ChevronLeftIcon } from "@/components/icons";
import { LEGAL_LAST_UPDATED, LEGAL_OWNER } from "@/lib/legal";

const LINK = "font-semibold text-primary-text underline underline-offset-2";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de Privacidad de Oído: qué datos recopilamos, para qué los usamos y con quién los compartimos. No vendemos tus datos, nunca.",
};

/** Bloque de sección: título + párrafos cortos, sin juridiqués. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-body leading-relaxed text-ink/60">
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-[calc(100vh-57px)] bg-paper px-4 py-10">
      <div className="app-container-reading">
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

        <div className="mt-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8">
          <h1 className="font-display text-h1 font-semibold tracking-tight text-ink sm:text-3xl">
            Política de Privacidad
          </h1>
          <p className="mt-1 text-sm text-ink/40">{LEGAL_LAST_UPDATED}</p>

          {/* Destacado: principio no-negociable, un solo acento naranja */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3.5 ring-1 ring-primary/20">
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-3 py-1 text-xs font-extrabold font-mono uppercase tracking-wide text-night">
              Promesa
            </span>
            <p className="text-sm font-bold text-ink">
              No vendemos tus datos. Nunca.
            </p>
          </div>

          <Section title="Quién es responsable de tus datos">
            <p>
              La responsable de la base de datos de Oído es{" "}
              <strong>{LEGAL_OWNER.name}</strong>, CUIL{" "}
              <span className="whitespace-nowrap">{LEGAL_OWNER.cuil}</span>,
              con domicilio en {LEGAL_OWNER.address}, República Argentina.
            </p>
            <p>
              Para cualquier consulta, pedido o reclamo sobre tus datos,
              escribinos a{" "}
              <a href={`mailto:${LEGAL_OWNER.email}`} className={LINK}>
                {LEGAL_OWNER.email}
              </a>{" "}
              o por el{" "}
              <Link href="/support" className={LINK}>
                soporte dentro de la app
              </Link>
              . El mail funciona aunque no tengas cuenta o ya la hayas dado de
              baja.
            </p>
          </Section>

          <Section title="Qué datos recopilamos">
            <p className="font-semibold text-ink">Si sos trabajador</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Cuenta:</strong> nombre, email y contraseña (guardada
                cifrada, nunca en texto plano). Si entrás con Google,
                recibimos de Google tu nombre, tu email y tu foto; nunca tu
                contraseña de Google.
              </li>
              <li>
                <strong>Perfil:</strong> foto, fecha de nacimiento (para
                confirmar que sos mayor de edad), ciudad, domicilio
                aproximado, presentación, posiciones en las que trabajás, años
                de experiencia, idiomas, certificaciones y, si lo subís, tu
                CV.
              </li>
              <li>
                <strong>Verificación de identidad (opcional):</strong> foto de
                tu DNI y una selfie. Las mira una persona del equipo para
                confirmar que sos quien decís ser, y{" "}
                <strong>se borran apenas se aprueba o rechaza</strong>. Lo
                único que queda es el resultado y la fecha. La selfie no se
                usa para ninguna otra cosa.
              </li>
              <li>
                <strong>Reputación:</strong> las calificaciones y reseñas que
                recibís, los turnos completados, tu puntualidad, tus
                cancelaciones y tus inasistencias.
              </li>
            </ul>

            <p className="font-semibold text-ink">Si sos comercio</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Cuenta:</strong> nombre, email y contraseña, o los
                datos de Google si entrás con Google.
              </li>
              <li>
                <strong>Perfil del local:</strong> nombre, logo, fotos, rubro,
                descripción, dirección con su ubicación en el mapa, capacidad
                y horarios.
              </li>
              <li>
                <strong>Verificación del comercio (opcional):</strong> tu
                constancia de inscripción de AFIP. La revisa una persona y{" "}
                <strong>se borra al decidir</strong>. No guardamos tu número
                de CUIT.
              </li>
              <li>
                <strong>Turnos y suscripción:</strong> los turnos que publicás
                (puesto, horario, pago) y los datos de tu plan. Si pagás un
                plan, el pago lo procesa Mercado Pago: nosotros no vemos ni
                guardamos los datos de tu tarjeta.
              </li>
              <li>
                <strong>Reputación:</strong> calificaciones, reseñas,
                cancelaciones tardías y cumplimiento de pagos.
              </li>
            </ul>

            <p className="font-semibold text-ink">Para todos</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Constancia de aceptación:</strong> cuándo aceptaste
                estos términos y esta política, qué versión y si fue con tu
                email o con Google, para poder mostrarlo si alguna vez hace
                falta.
              </li>
              <li>
                <strong>Mensajes:</strong> el chat entre comercio y trabajador
                para coordinar cada turno.
              </li>
              <li>
                <strong>Ubicación:</strong> durante el check-in y check-out de
                un turno ya confirmado, para verificar que estuviste ahí; y
                mientras vos elijas avisar que vas en camino, para que el
                comercio vea que estás llegando. Esto último lo prendés y lo
                apagás vos, sólo funciona hasta dos horas antes del turno, se
                corta solo cuando marcás tu llegada, y guardamos únicamente tu
                última posición, nunca el recorrido. Fuera de esas ventanas no
                te seguimos, ni en segundo plano.
                <br />
                Si activás &quot;Disponible ahora&quot; para que el comercio
                busque cerca de dónde estás en vez de tu domicilio, es el
                mismo mecanismo: una sola posición (no un seguimiento), dura
                hasta 4 horas o hasta que la apagués, y se borra sola al
                vencer. Ni ahí ni en tu perfil el mapa muestra tu ubicación
                exacta: siempre la vemos desplazada dentro de tu zona, con una
                precisión que alcanza para decidir a quién contactar y no
                para llegar a tu puerta.
              </li>
              <li>
                <strong>Asistente de IA:</strong> lo que le escribís al
                asistente, o en &quot;Describí el turno&quot;, se manda a
                Google para interpretarlo (ver más abajo). No escribas ahí
                datos que no quieras compartir.
              </li>
              <li>
                <strong>Notificaciones:</strong> si las activás, guardamos el
                identificador que tu navegador nos da para mandarte avisos. Se
                borra al desactivarlas.
              </li>
              <li>
                <strong>Datos técnicos:</strong> cuando algo falla,
                registramos el error (qué pantalla, qué navegador) para
                arreglarlo. No incluye tu contraseña ni tus mensajes.
              </li>
            </ul>
            <p>
              <strong>Qué es obligatorio.</strong> Para tener una cuenta
              necesitamos tu nombre y tu email; sin eso no podemos crearla.
              Todo lo demás es opcional: si no lo cargás la app funciona igual,
              pero con menos. Por ejemplo, sin la verificación no tenés el
              sello de &quot;verificado&quot;, y sin ubicación no podemos
              mostrarte turnos cerca.
            </p>
          </Section>

          <Section title="Para qué los usamos">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Crear y mantener tu cuenta.</li>
              <li>
                Mostrarte turnos o candidatos, ordenados por cercanía,
                experiencia y reputación.
              </li>
              <li>
                Coordinar cada turno: postulación, asignación, chat, check-in
                y check-out.
              </li>
              <li>
                Verificar identidades y comercios, y mostrarle el sello a la
                otra parte.
              </li>
              <li>Calcular la reputación y las insignias.</li>
              <li>
                Calcular el pago de referencia de cada puesto, con los turnos
                publicados y sin identificar a nadie.
              </li>
              <li>
                Mandarte mails (confirmación de cuenta, recuperar contraseña)
                y, si las activás, notificaciones.
              </li>
              <li>Responder lo que le pedís al asistente de IA.</li>
              <li>Cobrar la suscripción del comercio.</li>
              <li>
                Prevenir fraude, cuentas falsas y uso indebido, y arreglar
                errores.
              </li>
            </ul>
            <p>
              No usamos tus datos para publicidad ni para nada que no esté en
              esta lista.
            </p>
          </Section>

          <Section title="Con quién los compartimos">
            <p>
              <strong>Con la otra parte de un turno</strong>, lo necesario
              para decidir y coordinar. El comercio ve tu nombre, foto,
              experiencia, reputación y una ubicación aproximada, nunca la
              exacta. Vos ves el nombre, la dirección y la reputación del
              comercio.
            </p>
            <p>
              <strong>Con los proveedores que nos ayudan a operar</strong>,
              que tratan los datos sólo por cuenta nuestra y para esto:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>Vercel: sirve la app web (EE.UU. y red global).</li>
              <li>Render: servidor de la app (EE.UU.).</li>
              <li>Neon: base de datos (EE.UU.).</li>
              <li>
                Cloudinary: fotos, CV y documentos de verificación (EE.UU.).
              </li>
              <li>Resend: envío de mails (Brasil).</li>
              <li>Sentry: registro de errores (EE.UU.).</li>
              <li>
                Google: acceso con Google y asistente de IA, Gemini (EE.UU.).
                Según las condiciones de Google, el texto que se le manda a
                Gemini puede usarse para mejorar sus productos.
              </li>
              <li>
                OpenStreetMap (Nominatim): buscar direcciones en el mapa
                (Europa).
              </li>
              <li>
                El servicio de notificaciones de tu navegador (Google, Apple o
                Mozilla): entregar los avisos.
              </li>
              <li>Mercado Pago: cobro de la suscripción (Argentina).</li>
            </ul>
            <p>
              <strong>Con autoridades</strong>, sólo si una ley o un juez nos
              lo exige.
            </p>
            <p className="font-semibold text-ink">
              Jamás vendemos tus datos a nadie, por ningún motivo.
            </p>
          </Section>

          <Section title="Transferencia internacional">
            <p>
              Varios de estos proveedores guardan o procesan datos fuera de la
              Argentina, en países que la autoridad argentina no considera con
              un nivel de protección equivalente, como Estados Unidos y
              Brasil. Al crear tu cuenta y aceptar esta política prestás tu
              consentimiento expreso para esa transferencia, que se hace sólo
              a los proveedores de la lista y sólo para prestarte el servicio.
            </p>
          </Section>

          <Section title="Cuánto tiempo los guardamos">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>DNI, selfie y constancia de AFIP:</strong> hasta que se
                decide la verificación. Después se borran.
              </li>
              <li>
                <strong>&quot;Va en camino&quot;:</strong> hasta que marcás la
                llegada o el turno deja de estar asignado a vos.
              </li>
              <li>
                <strong>&quot;Disponible ahora&quot;:</strong> hasta 4 horas, o
                hasta que lo apagues.
              </li>
              <li>
                <strong>Cuenta, perfil, turnos, chats y reseñas:</strong>{" "}
                mientras tu cuenta esté activa. Cuando la das de baja, los
                borramos o los dejamos anónimos dentro de los 30 días.
              </li>
              <li>
                <strong>Lo que la ley nos obliga a guardar:</strong> los
                comprobantes de cobro de la suscripción, 10 años (normativa
                fiscal), y lo necesario para atender un reclamo, 5 años
                (plazo de prescripción).
              </li>
            </ul>
          </Section>

          <Section title="Tus derechos">
            <p>
              Tenés derecho a <strong>acceder</strong> a tus datos,{" "}
              <strong>rectificarlos</strong>, <strong>actualizarlos</strong> y{" "}
              <strong>suprimirlos</strong>, y a retirar tu consentimiento
              cuando quieras. Escribinos a{" "}
              <a href={`mailto:${LEGAL_OWNER.email}`} className={LINK}>
                {LEGAL_OWNER.email}
              </a>{" "}
              o por el chat de soporte; te podemos pedir que confirmes que sos
              el titular de la cuenta. Muchos datos los podés corregir vos
              desde tu perfil.
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Acceso:</strong> te respondemos en un máximo de 10 días
                corridos, sin costo.
              </li>
              <li>
                <strong>Rectificación, actualización o supresión:</strong> lo
                hacemos en un máximo de 5 días hábiles.
              </li>
            </ul>
            <p className="rounded-2xl bg-surface p-4 text-caption leading-relaxed">
              El titular de los datos personales tiene la facultad de ejercer
              el derecho de acceso a los mismos en forma gratuita a intervalos
              no inferiores a seis meses, salvo que se acredite un interés
              legítimo al efecto conforme lo establecido en el artículo 14,
              inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA
              INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la
              Ley Nº 25.326, tiene la atribución de atender las denuncias y
              reclamos que interpongan quienes resulten afectados en sus
              derechos por incumplimiento de las normas vigentes en materia de
              protección de datos personales.
            </p>
            <p>
              Podés contactar a la{" "}
              <strong>Agencia de Acceso a la Información Pública</strong> en{" "}
              <a
                href="https://www.argentina.gob.ar/aaip"
                className={LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                argentina.gob.ar/aaip
              </a>
              .
            </p>
          </Section>

          <Section title="Cookies y almacenamiento en tu navegador">
            <p>
              Usamos una <strong>cookie propia</strong> para mantener tu
              sesión iniciada de forma segura (el navegador no deja que ningún
              script la lea), y el almacenamiento local del navegador para
              recordar tu sesión y tu preferencia de tema claro u oscuro. No
              usamos cookies de terceros, ni de publicidad, ni de seguimiento.
            </p>
          </Section>

          <Section title="Seguridad">
            <p>
              Tu contraseña se guarda cifrada con un algoritmo de una sola vía
              (nadie, ni nosotros, puede leerla), toda la comunicación entre tu
              dispositivo y nuestros servidores viaja cifrada, y los documentos
              de verificación sólo los ve quien los revisa, antes de borrarse.
              Si alguna vez hubiera un incidente que afecte tus datos, te
              avisamos.
            </p>
          </Section>

          <Section title="Menores de edad">
            <p>
              Oído es sólo para mayores de 18 años. Si detectamos una cuenta
              de un menor, la damos de baja y borramos sus datos.
            </p>
          </Section>

          <Section title="Baja de cuenta">
            <p>
              Podés pedir la baja cuando quieras, por mail o por el chat de
              soporte. Se aplica lo que dice &quot;Cuánto tiempo los
              guardamos&quot;.
            </p>
          </Section>

          <Section title="Cambios en esta política">
            <p>
              Si cambiamos algo importante, te avisamos dentro de la app con
              al menos 15 días corridos de anticipación. La fecha de arriba
              indica la versión vigente.
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-sm text-ink/50">
          ¿Buscabas los{" "}
          <Link href="/terminos" className="font-semibold text-primary-text hover:underline">
            Términos y Condiciones
          </Link>
          ?
        </p>
      </div>
    </div>
  );
}
