// 3a y 3b · Instalá Oído (Android con Chrome, iPhone con Safari), 20 s cada uno.
// Los pasos y sus textos son los de frontend/components/landing/InstalarPasos.tsx.
// Un trozo de texto puede ser un ícono ({ icono }) o ir subrayado ({ subrayado }).
import { PAGA, type DatosBase, type DatosChip } from "../kit/datos";
import type { Sonido } from "../kit/sonido";

export type Trozo = string | { icono: "tresPuntos" | "compartir" | "agregar" } | { subrayado: string };
export type DatosPaso = { trozos: Trozo[]; size?: number };

const sonidoInstalar = (comun: number[]): Sonido => ({
  murmullo: false,
  cues: [["toque", 176, -3], ["toque", comun[0], -3], ["toque", 352, -3], ["impresora", 382, -20], ["toque", 448, -3], ["campanita", 536, -3]],
});

const base = {
  duracion: 600,
  cuenta: "@oidoapp" as const,
  paga: PAGA,
  chips: [{ texto: "El ícono de Oído, en tu pantalla", desde: 384, hasta: 440, y: 1500 }] as DatosChip[],
  pasoFinal: { trozos: ["Abrí Oído desde el ícono nuevo"] } as DatosPaso,
};

export const datosAndroid = {
  ...base,
  id: "instalar-android",
  titulo: "Instalá Oído en Android (Chrome)",
  titulos: [
    { lineas: ["Instalá Oído", "en tu Android."], desde: 2, hasta: 44, size: 96, acento: "Android." },
    { lineas: ["Se abre como", "una app."], desde: 480, hasta: 524, acento: "app." },
  ],
  pasos: [
    { trozos: ["Entrá a oido.com.ar desde Chrome"] },
    { trozos: ["Tocá ", { icono: "tresPuntos" }, " arriba a la derecha"] },
    { trozos: ["Elegí ", { subrayado: "Instalar app" }, " o Agregar a la pantalla principal"], size: 58 },
    { trozos: ["Confirmá con Instalar"] },
  ] as DatosPaso[],
  cierre: { boton: "Entrá a oido.com.ar", bajada: "Desde Chrome, en tu Android" },
  sonido: sonidoInstalar([268]),
} satisfies DatosBase & Record<string, unknown>;

export const datosIphone = {
  ...base,
  id: "instalar-iphone",
  titulo: "Instalá Oído en iPhone (Safari)",
  titulos: [
    { lineas: ["Instalá Oído", "en tu iPhone."], desde: 2, hasta: 44, size: 96, acento: "iPhone." },
    { lineas: ["Se abre como", "una app."], desde: 480, hasta: 524, acento: "app." },
  ],
  pasos: [
    { trozos: ["Entrá a oido.com.ar desde Safari"] },
    { trozos: ["Tocá ", { icono: "compartir" }, " Compartir, abajo"] },
    { trozos: ["Elegí ", { icono: "agregar" }, " Agregar a inicio"] },
    { trozos: ["Tocá Agregar, arriba a la derecha"] },
  ] as DatosPaso[],
  cierre: { boton: "Entrá a oido.com.ar", bajada: "Desde Safari, en tu iPhone" },
  sonido: sonidoInstalar([276]),
} satisfies DatosBase & Record<string, unknown>;

export type DatosInstalar = typeof datosAndroid;
