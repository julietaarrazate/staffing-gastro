import Badge from "@/components/ui/Badge";
import { ShieldIcon } from "@/components/icons";

/**
 * Chip visible "Identidad verificada" (EPIC-001, ADR-0010). Es un atributo de
 * **identidad**, no una insignia de reputación: por eso vive en su propio
 * componente con tratamiento propio (petróleo + escudo, `tone="trust"`,
 * ADR-0011), separado de las insignias de desempeño de `WorkerGameCard` —
 * hasta ADR-0011 usaba `tone="secondary"` (el mismo verde de cualquier
 * éxito genérico), exactamente la mezcla de conceptos que ADR-0010 §5 pedía
 * evitar.
 *
 * Renderiza `null` cuando la identidad no está verificada, así los callers
 * pueden dropearlo sin condicionar en cada pantalla.
 */
export default function IdentityVerifiedBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <Badge tone="trust" icon={<ShieldIcon size={13} />} className={className}>
      Identidad verificada
    </Badge>
  );
}
