import { Abril_Fatface } from "next/font/google";
import { brocha, mano } from "@/lib/letras";

/**
 * La letra mixta de la landing (decisión de Julieta, 2026-11-18; ver
 * docs/design-system/typography.md). Las tres son libres (OFL). La brocha y
 * la letra a mano se comparten con la app (`lib/letras.ts`); Abril Fatface es
 * sólo de la landing. Ninguna va en el layout raíz.
 *
 * - Brocha (Sedgwick Ave Display): sólo donde habría un cartel pintado, es
 *   decir el título del inicio, el cierre y los nombres de la carta. Va en
 *   mayúsculas. Es la del título que se ve al abrir, por eso se precarga.
 * - Abril Fatface: los títulos de sección. Es la hermana derecha de la
 *   Shrikhand del «oído», la letra gorda de los carteles.
 * - Mansalva: lo anotado a mano («sugerencia de la casa», la tiza de la
 *   pizarra). De una tipógrafa argentina.
 */
const abril = Abril_Fatface({
  variable: "--font-abril",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

/** Las tres variables, para el contenedor `[data-landing]`. */
export const LETRAS_LANDING = `${brocha.variable} ${abril.variable} ${mano.variable}`;
