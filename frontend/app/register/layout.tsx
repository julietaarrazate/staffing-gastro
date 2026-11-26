import type { Metadata } from "next";
import type { ReactNode } from "react";

// La página es de cliente y no puede exportar `metadata`: va acá. Sin esto
// heredaba el título genérico y ninguna dirección canónica.
export const metadata: Metadata = {
  title: "Crear cuenta",
  description:
    "Creá tu cuenta en Oído: publicá turnos gastronómicos y cubrilos en minutos, o encontrá turnos cerca tuyo en la Ciudad de Buenos Aires.",
  alternates: { canonical: "/register" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
