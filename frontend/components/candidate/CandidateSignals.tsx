import type { ComponentType } from "react";
import { Rating } from "@/components/ui";
import {
  AwardIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
  type IconProps,
} from "@/components/icons";
import { BADGE_ICONS, badgeLabel, formatPunctuality, levelLabel } from "@/lib/reputation";

/**
 * Señales legibles de un candidato/postulante, para que el comercio vea *por
 * qué* conviene alguien en vez de un score opaco (inspiración: la pantalla de
 * presupuestos de Clickie, "¿Por qué lo elige?"). Todos los datos ya vienen
 * del backend sin consulta extra (matching y JOIN de postulantes).
 */
export interface CandidateSignals {
  rating: number;
  events_completed: number;
  punctuality_rate: number;
  years_experience: number;
  distance_km?: number | null;
  // F1 (auditoría de producto 2026-08-10): insignias/nivel (ADR-0004) ya
  // calculados, ahora visibles donde el comercio decide a quién elegir.
  badges?: string[];
  level?: string;
}

interface Reason {
  Icon: ComponentType<IconProps>;
  label: string;
}

/**
 * Motivos positivos y VERDADEROS por los que recomendar a alguien, en orden de
 * peso (cercanía → puntualidad → experiencia → calificación → oficio). Sólo se
 * emiten cuando el dato los respalda, para no inflar a quien recién empieza.
 * Se muestran hasta 3 en la tarjeta del recomendado.
 */
export function topReasons(s: CandidateSignals, max = 3): Reason[] {
  const reasons: Reason[] = [];
  if (s.distance_km != null && s.distance_km <= 3) {
    reasons.push({ Icon: MapPinIcon, label: `A ${s.distance_km.toFixed(1)} km del local` });
  }
  if (s.events_completed >= 3 && s.punctuality_rate >= 0.9) {
    reasons.push({ Icon: ClockIcon, label: `Muy puntual (${formatPunctuality(s.punctuality_rate)})` });
  }
  if (s.events_completed >= 10) {
    reasons.push({ Icon: CheckCircleIcon, label: `${s.events_completed} turnos en Oído` });
  }
  if (s.rating >= 4.5 && s.events_completed >= 1) {
    reasons.push({ Icon: StarIcon, label: "Muy bien calificado" });
  }
  if (s.years_experience >= 3) {
    reasons.push({ Icon: AwardIcon, label: `${s.years_experience} años de oficio` });
  }
  return reasons.slice(0, max);
}

/** Chips factuales de confianza (neutros, un solo acento por pantalla). Sólo
 * los que tienen dato: no ensucia con "0 turnos" a quien recién arranca.
 *
 * `onDark` es para cuando estos chips viven adentro de una tarjeta negra (hoy,
 * el candidato recomendado). No es un tema aparte: es la "regla de la tarjeta
 * negra" de COLOR_SYSTEM §3.2 — sobre negro el relleno arena y la tinta al 60%
 * desaparecen, así que el chip pasa a un velo claro con texto crema. Va como
 * prop y no como `dark:` porque no depende del modo del usuario sino de la
 * SUPERFICIE sobre la que está dibujado. */
export function CandidateStatChips({
  signals,
  className,
  onDark = false,
}: {
  signals: CandidateSignals;
  className?: string;
  onDark?: boolean;
}) {
  const hasHistory = signals.events_completed > 0;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className ?? ""}`}>
      {/* `text-white/85` explícito sobre negro: el default de `Rating` es
          `text-ink/70`, que sobre la tarjeta negra desaparece — la estrella se
          veía y el número no. Encontrado mirando el render, no leyendo el
          código: el componente no dice en ningún lado que asuma fondo claro. */}
      <Rating value={signals.rating} className={onDark ? "text-white/85" : undefined} />
      {signals.distance_km != null && (
        <StatChip onDark={onDark}>{signals.distance_km.toFixed(1)} km</StatChip>
      )}
      {hasHistory && <StatChip onDark={onDark}>{signals.events_completed} turnos</StatChip>}
      {hasHistory && signals.punctuality_rate > 0 && (
        <StatChip onDark={onDark}>{formatPunctuality(signals.punctuality_rate)} puntual</StatChip>
      )}
      {signals.years_experience > 0 && (
        <StatChip onDark={onDark}>
          {signals.years_experience} {signals.years_experience === 1 ? "año" : "años"} exp.
        </StatChip>
      )}
      {signals.level && signals.level !== "bronce" && (
        <StatChip onDark={onDark}>{levelLabel(signals.level)}</StatChip>
      )}
      {(signals.badges ?? []).map((badge) => {
        const Icon = BADGE_ICONS[badge] ?? AwardIcon;
        return (
          <span
            key={badge}
            title={badgeLabel(badge)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              onDark ? "bg-primary text-night" : "bg-primary-tint text-primary-text"
            }`}
          >
            <Icon size={11} /> {badgeLabel(badge)}
          </span>
        );
      })}
    </div>
  );
}

function StatChip({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        onDark ? "bg-white/10 text-white/75" : "bg-surface text-ink/60"
      }`}
    >
      {children}
    </span>
  );
}

/** "Por qué te lo recomendamos": los motivos con el acento de marca.
 *  `onDark`: mismo criterio que `CandidateStatChips` (COLOR_SYSTEM §3.2). */
export function RecommendationReasons({
  signals,
  onDark = false,
}: {
  signals: CandidateSignals;
  onDark?: boolean;
}) {
  const reasons = topReasons(signals);
  if (reasons.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {reasons.map(({ Icon, label }) => (
        <p
          key={label}
          className={`flex items-center gap-1.5 text-sm font-medium ${
            onDark ? "text-white/85" : "text-ink/75"
          }`}
        >
          <Icon size={15} className={`shrink-0 ${onDark ? "text-primary" : "text-primary-text"}`} />
          {label}
        </p>
      ))}
    </div>
  );
}
