import type { Metadata } from "next";
import type { ReactNode } from "react";

// La página es de cliente y no puede exportar `metadata`: va acá. Sin esto
// heredaba el título genérico y ninguna dirección canónica.
export const metadata: Metadata = {
  title: "Ingresar",
  description:
    "Ingresá a Oído para ver tus turnos, postulaciones y mensajes.",
  alternates: { canonical: "/login" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
