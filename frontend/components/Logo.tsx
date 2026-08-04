/**
 * Marca Oído: mano ahuecada sobre la oreja (gesto de "¡oído!, va la orden"),
 * SVG vectorial final del diseñador (reemplazó el placeholder rasterizado,
 * ver docs/design/BRIEF_IDENTIDAD_VISUAL.md). Un solo `path` vectorizado (contornos
 * trazados a 6×, `fill-rule="evenodd"`) reusado en cada asset con distinto
 * recorte/escala/color — detalle en `frontend/public/oido-isotipo.svg` y
 * hermanos.
 *
 * `LogoGlyph` es sólo el trazo (mano + oreja), sin tile de fondo — se tiñe
 * del color pedido vía CSS mask (`logo-figure.svg` sólo aporta la silueta
 * en su canal alfa, el fill del SVG es irrelevante para una máscara). Lo
 * reusa SplashScreen/EmptyState sobre superficie neutra. `LogoMark` agrega
 * el tile naranja ya horneado (uso estándar: Navbar, favicon/app icons).
 * `Logo` agrega el wordmark y es el default export que ya consumen Navbar,
 * login/register/recuperar/restablecer y la landing.
 */
export function LogoGlyph({ size = 28, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <span
      role="img"
      aria-label="Oído"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: "url(/logo-figure.svg)",
        maskImage: "url(/logo-figure.svg)",
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
  return <img src="/logo-mark.svg" width={size} height={size} alt="Oído" />;
}

export default function Logo({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight text-ink">
          oído
        </span>
      )}
    </span>
  );
}
