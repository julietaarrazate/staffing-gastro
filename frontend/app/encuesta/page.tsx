import type { Metadata } from "next";
import { Suspense } from "react";
import EncuestaGate from "@/components/encuesta/EncuestaGate";

export const metadata: Metadata = {
  title: "Encuesta para locales",
  description:
    "Contanos cómo sumás personal eventual en tu local. Son 3 minutos y nos ayuda a armar Oído para bares, restaurantes y cafés.",
  openGraph: {
    title: "Encuesta para locales · Oído",
    description:
      "Contanos cómo sumás personal eventual en tu local. Son 3 minutos y nos ayuda a armar Oído.",
    type: "website",
  },
  // Es para quien recibe el link: no hace falta que la encuentre un buscador.
  robots: { index: false, follow: false },
};

export default function EncuestaPage() {
  return (
    <Suspense fallback={null}>
      <EncuestaGate />
    </Suspense>
  );
}
