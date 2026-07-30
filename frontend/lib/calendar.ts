import { SKILL_LABELS, Shift } from "@/lib/types";

/** `2026-07-10T20:00:00-03:00` → `20260710T230000Z` (UTC, formato ICS). */
function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escapa coma/punto y coma/salto de línea, según RFC 5545. */
function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

/**
 * Descarga un .ics con el turno para agendarlo en el calendario del celular
 * (Google Calendar, Apple Calendar, Outlook todos lo importan) — antes no
 * había forma de que quede un recordatorio, sólo el turno vivía adentro de la
 * app (Julieta, 2026-07-30).
 */
export function downloadShiftIcs(shift: Shift): void {
  const title = `${SKILL_LABELS[shift.position]}${shift.company_name ? ` en ${shift.company_name}` : ""}`;
  const location = [shift.address, shift.city].filter(Boolean).join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oido//Turno//ES",
    "BEGIN:VEVENT",
    `UID:${shift.id}@oido.app`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(shift.start_at)}`,
    `DTEND:${toIcsUtc(shift.end_at)}`,
    `SUMMARY:${escapeIcs(title)}`,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `turno-${shift.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
