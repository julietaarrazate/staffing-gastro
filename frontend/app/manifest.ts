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
    // `background_color` es el fondo de la pantalla de arranque que arma
    // Android al abrir la app instalada, antes de que cargue la nuestra. Va
    // en el azul hondo del ícono (2026-11-18): Android muestra ahí el ícono
    // con margen (`icon-maskable-512.png`), que es un cuadrado de ese azul, y
    // sobre blanco quedaba un cuadradito suelto con «Oído» en letra de
    // sistema (Julieta: "se ve eso que es feo antes de leerse oído"). Con el
    // mismo azul el cuadrado desaparece: se ve el pinche sobre un fondo
    // entero. Si se cambia el fondo del ícono
    // (`scripts/build-isotipo-pinche.py`), cambiar esto también.
    //
    // Ojo: Android usa este color también para su barra de abajo mientras la
    // app está abierta (el 2026-10-19 era crema por eso, y se pasó a blanco).
    // `theme_color` (la barra de arriba) sigue en blanco.
    background_color: "#1c5478",
    theme_color: "#ffffff",
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
