import { LogoGlyph } from "@/components/Logo";
import { cn } from "@/lib/cn";

/**
 * Espera con la marca: la mano de Oído en su tile ámbar, con ondas que salen
 * como sonido y un leve ladeo de "escuchar". Es para las esperas LARGAS
 * (la IA interpretando un pedido, el panel de admin cargando todo): ahí un
 * spinner genérico se siente trabado y un esqueleto gris no dice qué pasa.
 * Para lo corto (un botón enviando) sigue el spinner del botón.
 *
 * Puro CSS (`oidoWave`/`oidoTilt` en globals.css): con "reducir movimiento"
 * la regla global lo deja quieto, y el texto sigue diciendo qué pasa.
 */
export default function OidoLoader({
  label,
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tile = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const glyph = size === "sm" ? 15 : 20;
  return (
    <span role="status" className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center", tile)}>
        <span className="absolute inset-0 rounded-full bg-primary/35 [animation:oidoWave_1.6s_ease-out_infinite]" />
        <span className="absolute inset-0 rounded-full bg-primary/25 [animation:oidoWave_1.6s_ease-out_0.8s_infinite]" />
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-primary">
          <span className="flex [animation:oidoTilt_1.6s_ease-in-out_infinite]">
            <LogoGlyph size={glyph} color="#1f1f1c" />
          </span>
        </span>
      </span>
      {label ? (
        <span className={cn("font-medium text-ink/60", size === "sm" ? "text-xs" : "text-sm")}>{label}</span>
      ) : (
        <span className="sr-only">Cargando…</span>
      )}
    </span>
  );
}
