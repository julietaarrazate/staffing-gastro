import { OG_ALT, OG_SQUARE, renderBrandImage } from "@/lib/og-brand";

// Vista previa de cualquier link de Oído en WhatsApp/Facebook/iMessage:
// cuadrada para que WhatsApp la muestre grande. Diseño en `lib/og-brand.tsx`.
export const alt = OG_ALT;
export const size = OG_SQUARE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderBrandImage(OG_SQUARE);
}
