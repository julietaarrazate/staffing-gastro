// Versión del build desplegado. Siempre dinámica y sin caché: el navegador
// la compara con la de su bundle (`NEXT_PUBLIC_BUILD_ID`) para recargarse sola
// cuando hay un deploy nuevo. Ver `components/ActualizadorVersion.tsx`.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
