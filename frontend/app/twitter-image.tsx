import { OG_ALT, OG_WIDE, renderBrandImage } from "@/lib/og-brand";

// La misma marca para X/Twitter (summary_large_image), apaisada porque X
// recorta a 2:1. Diseño en `lib/og-brand.tsx`.
export const alt = OG_ALT;
export const size = OG_WIDE;
export const contentType = "image/png";

export default function TwitterImage() {
  return renderBrandImage(OG_WIDE);
}
