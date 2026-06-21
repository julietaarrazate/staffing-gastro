import type { NextConfig } from "next";

// La URL del backend se toma de NEXT_PUBLIC_API_URL si está definida
// (ej: .env.local en desarrollo apunta a localhost). Si no está definida
// —como en el build de producción de Vercel— cae al backend de Render.
// Se deja acá (y no en un .env.production) porque los .env están en
// .gitignore; este archivo sí se versiona y no es un secreto: las vars
// NEXT_PUBLIC_* se inlinean en el bundle del browser de todos modos.
const PROD_API_URL = "https://staffya-backend.onrender.com/api/v1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? PROD_API_URL,
  },
};

export default nextConfig;
