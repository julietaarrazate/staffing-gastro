import { cn } from "@/lib/cn";

/**
 * Los pasos de un formulario en un renglón, como en el pase de la cocina
 * (dirección «con relieve», 2026-11-19): lo hecho se tacha a mano en azul
 * hondo, el paso de ahora va en negrita y lo que falta en la letra suave. El
 * mismo gesto que los hitos del turno (`ShiftLifecycleStepper`). Lo usan la
 * bienvenida y «Publicar turno»; antes eran puntitos o una barra de progreso
 * en ámbar.
 *
 * `tono="cielo"`: sobre el cielo de arriba de una pantalla (`.app-cielo`)
 * todos van en la tinta del cielo (la letra suave no llegaba a 4,5 sobre el
 * celeste); el de ahora se distingue por la negrita y lo hecho por la tacha.
 */
export default function PasosTachados({
  active,
  labels,
  className,
  tono = "lienzo",
}: {
  active: number;
  labels: readonly string[];
  className?: string;
  tono?: "lienzo" | "cielo";
}) {
  return (
    // `role="list"` explícito: sin viñetas, Safari le saca a la lista su rol.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ol
      role="list"
      aria-label={`Paso ${active + 1} de ${labels.length}: ${labels[active]}`}
      className={cn("pasos-tachados flex flex-wrap items-baseline gap-x-4 gap-y-1", className)}
    >
      {labels.map((label, i) => (
        <li
          key={label}
          aria-current={i === active ? "step" : undefined}
          className={cn(
            "text-sm",
            i === active ? "font-bold" : "font-medium",
            tono === "cielo" ? "text-[color:var(--app-cielo-tinta)]" : i === active ? "text-ink" : "text-ink-soft"
          )}
        >
          <span className="relative">
            {label}
            {i < active && (
              <>
                <svg className="tacha" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 6C20 2 40 8 60 4S90 3 98 6" />
                </svg>
                <span className="sr-only"> (hecho)</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
