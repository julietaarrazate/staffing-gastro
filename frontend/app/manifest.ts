import type { MetadataRoute } from "next";

// Web App Manifest de la PWA. Next.js lo sirve en /manifest.webmanifest
// y agrega automáticamente el <link rel="manifest"> en el <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oído",
    short_name: "Oído",
    description:
      "Publicás un turno y en minutos tenés candidatos rankeados por cercanía y reputación.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f0",
    theme_color: "#ff6b00",
    lang: "es",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
