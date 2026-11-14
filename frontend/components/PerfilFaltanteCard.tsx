import Link from "next/link";

/**
 * Cartel fijo de «te falta completar…»: la cuenta existe pero su perfil no, o
 * el del trabajador no tiene zona u oficio (G12, U034, U035). Reemplaza al
 * error genérico («Primero creá tu perfil…») que salía del backend y deja un
 * solo botón que lleva a completarlo. Sin cerrar: desaparece cuando se
 * completa.
 */
export default function PerfilFaltanteCard({
  title,
  body,
  actionLabel,
  href,
}: {
  title: string;
  body?: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid="perfil-faltante"
      className="mt-4 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line"
    >
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {body && <p className="mt-1 text-sm leading-relaxed text-ink/60">{body}</p>}
      <Link
        href={href}
        className="mt-3 flex min-h-[44px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-4 text-sm font-bold text-night shadow-[var(--shadow-primary-sm)] transition active:scale-95"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
