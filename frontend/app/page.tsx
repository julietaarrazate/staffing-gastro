import type { Metadata, Viewport } from "next";
import LandingGate from "@/components/landing/LandingGate";
import { PREGUNTAS } from "@/components/landing/preguntas";
import { SITE_URL } from "@/lib/site";
import { INSTALAR_SCRIPT } from "@/lib/instalar-script";

// La home declara su URL canónica (sin parámetros como `?rol=` o los de las
// campañas) y, en datos estructurados, quién es Oído y sus preguntas
// frecuentes: la misma lista que se ve en la sección (components/landing/
// preguntas.ts).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// En la landing se puede agrandar con dos dedos (WCAG 1.4.4). El layout lo
// bloquea para el resto de la app porque sus campos usan 14px y iOS haría
// zoom solo al enfocarlos; la landing no tiene campos. El resto del viewport
// (viewport-fit, colores) se hereda del layout.
export const viewport: Viewport = {
  maximumScale: 5,
  userScalable: true,
};

const DATOS = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oído",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    areaServed: { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map((p) => ({
      "@type": "Question",
      name: p.pregunta,
      acceptedAnswer: { "@type": "Answer", text: p.respuesta },
    })),
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escapado de `<` para que un texto nunca pueda cerrar el <script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS).replace(/</g, "\\u003c") }}
      />
      {/* Atrapa el aviso de "se puede instalar" de Android aunque llegue
          antes de que la página termine de cargar (lib/instalar.ts). */}
      <script dangerouslySetInnerHTML={{ __html: INSTALAR_SCRIPT }} />
      {/* Marca que hay JavaScript antes de pintar: así las animaciones del
          hero arrancan escondidas y no titilan (ver globals.css). */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('landing-js')" }} />
      <LandingGate />
    </>
  );
}
