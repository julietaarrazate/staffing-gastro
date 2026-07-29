/**
 * Marca Oído: mano ahuecada sobre la oreja (gesto de "¡oído!, va la orden"),
 * placeholder rasterizado a partir del ícono real del diseñador — no es el
 * SVG vectorial final (ver docs/BRIEF_IDENTIDAD_VISUAL.md y el pendiente de
 * reemplazo por el export vectorial del diseñador). El asset fuente nunca
 * se usa a más de 48px en el código, así que el raster no pierde nitidez.
 *
 * `LogoGlyph` es sólo el trazo (mano + oreja), sin tile de fondo — se tiñe
 * del color pedido vía CSS mask (`logo-figure.png` sólo aporta la silueta
 * en su canal alfa). Lo reusa SplashScreen/EmptyState sobre superficie
 * neutra. `LogoMark` agrega el tile naranja ya horneado (uso estándar:
 * Navbar, favicon/app icons). `Logo` agrega el wordmark y es el default
 * export que ya consumen Navbar, login/register/recuperar/restablecer y la
 * landing.
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
        WebkitMaskImage: "url(/logo-figure.png)",
        maskImage: "url(/logo-figure.png)",
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
  return <img src="/logo-mark.png" width={size} height={size} alt="Oído" />;
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
        <span className="text-xl font-extrabold tracking-tight text-ink">oído</span>
      )}
    </span>
  );
}
