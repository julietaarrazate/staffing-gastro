import { Abril_Fatface, Mansalva, Sedgwick_Ave_Display } from "next/font/google";

/**
 * La letra mixta de la landing (decisión de Julieta, 2026-11-18; ver
 * docs/design-system/typography.md). Las tres son libres (OFL) y se cargan
 * sólo acá, no en el layout raíz: la app todavía no las usa y no tiene por
 * qué bajarlas.
 *
 * - Brocha (Sedgwick Ave Display): sólo donde habría un cartel pintado, es
 *   decir el título del inicio, el cierre y los nombres de la carta. Va en
 *   mayúsculas. Es la del título que se ve al abrir, por eso se precarga.
 * - Abril Fatface: los títulos de sección. Es la hermana derecha de la
 *   Shrikhand del «oído», la letra gorda de los carteles.
 * - Mansalva: lo anotado a mano («sugerencia de la casa», la tiza de la
 *   pizarra). De una tipógrafa argentina.
 */
const brocha = Sedgwick_Ave_Display({
  variable: "--font-brocha",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const abril = Abril_Fatface({
  variable: "--font-abril",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

const mano = Mansalva({
  variable: "--font-mano",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

/** Las tres variables, para el contenedor `[data-landing]`. */
export const LETRAS_LANDING = `${brocha.variable} ${abril.variable} ${mano.variable}`;
