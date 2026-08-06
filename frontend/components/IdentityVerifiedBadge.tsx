import Badge from "@/components/ui/Badge";
import { ShieldIcon } from "@/components/icons";

/**
 * Chip visible "Identidad verificada" (EPIC-001, ADR-0010). Es un atributo de
 * **identidad**, no una insignia de reputación: por eso vive en su propio
 * componente con tratamiento propio (verde éxito + escudo), separado de las
 * insignias de desempeño de `WorkerGameCard`.
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
    <Badge tone="secondary" icon={<ShieldIcon size={13} />} className={className}>
      Identidad verificada
    </Badge>
  );
}
