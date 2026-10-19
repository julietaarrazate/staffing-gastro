import type { Metadata } from "next";
import LandingStory from "@/components/landing/story/LandingStory";

// La landing anterior, "la historia de un turno" (2026-10-06 → 2026-10-12),
// guardada en su propia dirección para grabar reels e historias de Instagram
// (Julieta, 2026-10-12: es más visual y explicativa para redes). No se
// indexa ni está en el sitemap: el inicio es la landing corta.
export const metadata: Metadata = {
  title: "La historia de un turno",
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

export default function Historia() {
  return <LandingStory />;
}
