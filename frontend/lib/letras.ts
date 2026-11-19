import { Bricolage_Grotesque, Mansalva, Sedgwick_Ave_Display } from "next/font/google";

/**
 * La brocha y la letra a mano de la dirección «con relieve» (decisión de
 * Julieta, 2026-11-18; docs/design-system/typography.md). Libres (OFL).
 *
 * No van en el layout raíz: cada pantalla que ya migró importa
 * `LETRAS_APP` y lo pone en su contenedor, así las pantallas que todavía no
 * las usan (y las públicas, como el ingreso) no las bajan. La landing suma
 * Abril Fatface en `components/landing/letras.ts`.
 *
 * - Brocha (Sedgwick Ave Display): el título de la pantalla y el puesto de
 *   la comanda. Siempre en mayúsculas (`.letra-cartel`). Se precarga: es lo
 *   primero que se lee.
 * - Mansalva: lo anotado a mano (`.letra-mano`), un apunte por pantalla.
 */
export const brocha = Sedgwick_Ave_Display({
  variable: "--font-brocha",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const mano = Mansalva({
  variable: "--font-mano",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

/**
 * PRUEBA (2026-11-19, la propuesta de Oído «si fuese mía»): una grotesca con
 * carácter para los títulos y la plata, en lugar de Inter. Por ahora sólo la
 * usa el detalle del turno (`LETRA_TITULOS`), para que Julieta la vea en la
 * app real antes de decidir.
 */
export const titulos = Bricolage_Grotesque({
  variable: "--font-titulos",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});
export const LETRA_TITULOS = titulos.variable;

/** Las dos variables, para el contenedor de una pantalla de la app. */
export const LETRAS_APP = `${brocha.variable} ${mano.variable}`;
