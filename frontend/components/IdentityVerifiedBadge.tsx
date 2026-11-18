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
  responsive = false,
}: {
  verified: boolean;
  className?: string;
  /**
   * Para columnas angostas (la fila del postulante, junto a «Asignar»): desde
   * 390 px el chip entero «Identidad verificada»; de 360 a 389 px el escudo
   * con «Verificada»; por debajo de 360 px sólo el escudo. Se alterna con CSS
   * (`display: none` saca del árbol de accesibilidad), así que a cada ancho
   * hay un solo sello, y su nombre accesible es siempre «Identidad verificada».
   */
  responsive?: boolean;
}) {
  if (!verified) return null;
  if (!responsive) {
    return (
      <Badge tone="trust" icon={<ShieldIcon size={13} />} className={className}>
        Identidad verificada
      </Badge>
    );
  }
  const escudo = <ShieldIcon size={13} />;
  return (
    <span className={className}>
      <span className="hidden min-[390px]:inline-flex">
        <Badge tone="trust" dense icon={escudo} className="whitespace-nowrap">
          Identidad verificada
        </Badge>
      </span>
      <span
        role="img"
        aria-label="Identidad verificada"
        title="Identidad verificada"
        className="hidden min-[360px]:inline-flex min-[390px]:hidden"
      >
        <Badge tone="trust" dense icon={escudo} className="whitespace-nowrap">
          Verificada
        </Badge>
      </span>
      <span
        role="img"
        aria-label="Identidad verificada"
        title="Identidad verificada"
        className="inline-flex min-[360px]:hidden"
      >
        <Badge tone="trust" dense icon={escudo}>
          {null}
        </Badge>
      </span>
    </span>
  );
}
