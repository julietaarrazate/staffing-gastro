import { ShieldIcon, CheckIcon } from "@/components/icons";

/**
 * «Si algo falla»: le pone palabras a mecanismos que ya existen (no-show
 * reabre el turno, reputación real, chat previo) para dar tranquilidad al
 * comercio. Es sólo copy de confianza, no hay lógica nueva detrás.
 *
 * Hasta el 2026-11-26 se llamaba «Garantía Oído». Se le cambió el nombre
 * porque los Términos dicen que Oído no garantiza la asistencia ni es
 * garante de las partes: la app no puede decir lo contrario.
 */
const POINTS = [
  "Si no se presenta, reabrís el turno y elegís a otro al instante — sin volver a publicar.",
  "Puntualidad y reseñas reales, derivadas de turnos hechos en Oído (no autodeclaradas).",
  "Podés chatear con el trabajador antes de confirmar la asignación.",
];

export default function GuaranteeCard() {
  return (
    <div className="rounded-[var(--radius-card)] bg-primary-tint p-4 ring-1 ring-primary/15">
      <p className="flex items-center gap-2 font-bold text-primary-text">
        <ShieldIcon size={18} /> Si algo falla
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-ink/75">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-primary-text" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
