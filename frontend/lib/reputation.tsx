import type { ComponentType } from "react";
import {
  AwardIcon,
  CheckCircleIcon,
  GlassIcon,
  UsersIcon,
  type IconProps,
} from "@/components/icons";

/**
 * Reputación del trabajador (ADR-0004 + R2.4): mapeos de los enums crudos que
 * devuelve el backend (`worker/domain/value_objects.py`) a etiquetas e
 * íconos legibles en español. Única fuente de verdad de estos labels — no
 * dupliques el mapeo en las pantallas, importá de acá.
 *
 * `perfil_verificado` **ya no vive acá** (EPIC-001, ADR-0010): la identidad es
 * un dominio separado de la reputación. "Identidad verificada" se muestra con
 * `IdentityVerifiedBadge` (`lib/identity.ts`), no como insignia de desempeño.
 */

export type WorkerBadge =
  | "nunca_falto"
  | "top_mozo"
  | "top_bartender"
  | "eventos_premium";

export type WorkerLevel = "bronce" | "plata" | "oro" | "platino";

export const BADGE_LABELS: Record<string, string> = {
  nunca_falto: "Nunca faltó",
  top_mozo: "Top Mozo",
  top_bartender: "Top Bartender",
  eventos_premium: "Eventos Premium",
};

/** Una línea explicando qué significa cada insignia (tooltip/subtítulo). */
export const BADGE_DESCRIPTIONS: Record<string, string> = {
  nunca_falto: "Nunca faltó a un turno confirmado",
  top_mozo: "Entre los mejores puntuados como mozo/a",
  top_bartender: "Entre los mejores puntuados como bartender",
  eventos_premium: "Cubrió eventos premium con excelencia",
};

export const BADGE_ICONS: Record<string, ComponentType<IconProps>> = {
  nunca_falto: CheckCircleIcon,
  top_mozo: UsersIcon,
  top_bartender: GlassIcon,
  eventos_premium: AwardIcon,
};

export const LEVEL_LABELS: Record<string, string> = {
  bronce: "Bronce",
  plata: "Plata",
  oro: "Oro",
  platino: "Platino",
};

/** Orden (para progreso) y acento sobrio por nivel — dentro de la paleta, sin arcoíris. */
export const LEVEL_META: Record<
  string,
  { order: number; dot: string; text: string; bg: string; ring: string }
> = {
  // El acento se GANA: bronce arranca neutro (arena del sistema) y el color
  // aparece al subir de nivel — celeste en plata, manteca en oro. Manteca ES
  // el dorado de esta paleta, así que "oro" no necesita un amarillo importado.
  //
  // Antes esto era `zinc-100`/`zinc-600`/`amber-50`/`yellow-50`: colores
  // crudos de la escala de Tailwind, contra la regla de "todos los fondos
  // pasan por tokens de globals.css". Dos consecuencias medidas en un render
  // real (auditoría 2026-09-10):
  //   1. El `zinc` es un gris FRÍO en una identidad que es toda cálida — la
  //      tarjeta de nivel se leía como de otra app.
  //   2. Peor: ninguno de esos colores existe para el modo oscuro, así que la
  //      tarjeta seguía siendo `zinc-100` CLARA sobre el lienzo oscuro, con el
  //      subtítulo en `text-ink/50` — y en oscuro `--color-ink` es crema, así
  //      que era crema al 50% sobre un fondo casi blanco: **texto invisible**.
  //      Medido: la tarjeta daba `rgb(244,244,245)` idéntica en los dos modos.
  //
  // `bg-surface` sí está en la lista de superficies que voltean sus tokens en
  // oscuro (ver globals.css), y los pares manteca/cielo son auto-contenidos:
  // no cambian entre modos porque están calculados para leerse en los dos
  // (manteca-text sobre manteca-tint 6.08 · cielo-text sobre cielo-tint 7.67).
  //
  // `dot` va aparte del resto a propósito: vive en el HERO OSCURO de
  // `WorkerGameCard`, no en la tarjeta clara, así que necesita el tono CLARO
  // del par mientras `text` necesita el oscuro. Mismo color, dos roles.
  bronce: { order: 1, dot: "bg-white/60", text: "text-ink/70", bg: "bg-surface", ring: "ring-line" },
  plata: { order: 2, dot: "bg-cielo", text: "text-cielo-text", bg: "bg-cielo-tint", ring: "ring-cielo" },
  oro: { order: 3, dot: "bg-manteca", text: "text-manteca-text", bg: "bg-manteca-tint", ring: "ring-manteca" },
  platino: { order: 4, dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200" },
};

export const LEVEL_ORDER: WorkerLevel[] = ["bronce", "plata", "oro", "platino"];

export function badgeLabel(badge: string): string {
  return BADGE_LABELS[badge] ?? badge;
}

export function badgeDescription(badge: string): string | undefined {
  return BADGE_DESCRIPTIONS[badge];
}

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

export function levelMeta(level: string) {
  return LEVEL_META[level] ?? LEVEL_META.bronce;
}

/** "0.92" -> "92%" */
export function formatPunctuality(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** "4" -> "4.0", "4.567" -> "4.6" */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}
