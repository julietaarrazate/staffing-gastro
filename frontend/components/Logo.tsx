/**
 * Marca Oído (desde el 2026-11-17, ver docs/design-system/marca-hoy.md):
 *
 * - `LogoGlyph`: la silueta del pinche con la comanda y la «o» calada (letra
 *   convertida a trazos en `public/logo-figure.svg`), sin fondo, teñida del
 *   color pedido con una máscara CSS. La usan EmptyState, OidoLoader y los
 *   avisos de página. De menos de 24 px va la «o» sola (`public/logo-o.svg`).
 *   Hasta el 2026-11-17 era la mano ahuecada sobre la oreja.
 * - `LogoMark`: el ícono del pinche con «oído» en su tile azul hondo, en la
 *   versión plana (con la «o» sola) para tamaños chicos (`public/logo-mark-chico.svg`). La fileteada con relieve
 *   (`public/logo-mark.svg`) es la de los íconos grandes de la app
 *   (`scripts/build-icons.mjs`).
 * - `Logo` (default): la palabra «oído» plana en Shrikhand, en azul hondo
 *   (celeste en oscuro), como el encabezado de la landing. Sin la palabra,
 *   el ícono.
 */
export function LogoGlyph({ size = 28, color = "#fff" }: { size?: number; color?: string }) {
  // Por debajo de 24 px la silueta entera del pinche no se lee: va la «o» sola.
  const mascara = `url(${size < 24 ? "/logo-o.svg" : "/logo-figure.svg"})`;
  return (
    <span
      role="img"
      aria-label="Oído"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: mascara,
        maskImage: mascara,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- ícono chico (≤48px), no amerita next/image
  return <img src="/logo-mark-chico.svg" width={size} height={size} alt="Oído" />;
}

export default function Logo({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  if (!withWordmark) return <LogoMark size={size} />;
  return (
    <span
      role="img"
      aria-label="Oído"
      className="inline-block font-oido leading-none text-primary-text"
      style={{ fontSize: Math.round(size * 0.93), paddingTop: Math.round(size * 0.08) }}
    >
      oído
    </span>
  );
}
