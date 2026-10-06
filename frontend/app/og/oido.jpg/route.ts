import sharp from "sharp";
import { OG_SQUARE, renderBrandImage } from "@/lib/og-brand";

/**
 * La imagen de vista previa de Oído (`og:image`) como JPEG en una URL fija,
 * `/og/oido.jpg`. Se arma en el build desde `lib/og-brand.tsx`, igual que
 * antes, pero ya no por la convención `opengraph-image.tsx`, que la servía
 * como PNG con un hash en la URL (`/opengraph-image?03a3…`).
 *
 * Por qué: con el PNG, WhatsApp mostraba bien la imagen pero en el formato
 * chico (miniatura al costado del título), y no el grande que muestra para
 * TitoFree (2026-10-05). JPEG sin canal alfa, más liviano y en una URL sin
 * query es lo que suelen pedir los lectores de vista previa; se cambiaron
 * las tres cosas juntas porque no hay forma de probar WhatsApp desde acá.
 */
export const dynamic = "force-static";

export async function GET() {
  const png = Buffer.from(await (await renderBrandImage(OG_SQUARE)).arrayBuffer());
  const jpg = await sharp(png).flatten({ background: "#fbfaf6" }).jpeg({ quality: 85 }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
