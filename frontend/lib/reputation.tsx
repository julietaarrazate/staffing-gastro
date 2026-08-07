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
  bronce: { order: 1, dot: "bg-amber-600", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" },
  plata: { order: 2, dot: "bg-zinc-400", text: "text-zinc-600", bg: "bg-zinc-100", ring: "ring-zinc-200" },
  oro: { order: 3, dot: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50", ring: "ring-yellow-200" },
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
