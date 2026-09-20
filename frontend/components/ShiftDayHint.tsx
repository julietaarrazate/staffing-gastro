import { CalendarIcon } from "@/components/icons";
import { formatShiftDayLong, formatShiftTime, localInputToArgentinaISO } from "@/lib/datetime";

/**
 * El día elegido, en palabras, debajo del campo que lo eligió.
 *
 * POR QUÉ EXISTE. Julieta, publicando un turno de verdad (2026-09-16):
 * *"colocar la fecha debería salir un calendario, así te asegurás bien el día
 * […] o alguna manera de aclarar para que no haya confusión"*.
 *
 * El calendario, en rigor, YA aparece: `<input type="datetime-local">` abre el
 * selector nativo del sistema al tocarlo, en Android y en iOS. Lo que faltaba
 * no era el selector sino **la confirmación**: el campo vuelve mostrando
 * `20/09/2026 21:00`, y para saber si eso es el sábado que uno tenía en la
 * cabeza hay que hacer una cuenta mental. Nadie la hace, y el error se
 * descubre cuando el turno ya está publicado.
 *
 * Nadie piensa "el 20": piensa **"el sábado a la noche"**. Mostrando
 * *"sábado 20 de septiembre · 21:00"* el error salta sin esfuerzo — si querías
 * el viernes, la palabra te lo grita y el número no.
 *
 * DOS DECISIONES CHICAS QUE IMPORTAN:
 *
 * 1. **Va por campo, no al final.** Ya existía un resumen del rango completo,
 *    pero sólo aparece cuando los DOS extremos están cargados. El error se
 *    comete en el campo, y ahí hay que avisarlo — no dos pasos después.
 * 2. **Es un eco, no una validación.** No dice si la fecha está bien; repite
 *    en palabras lo que la persona acaba de elegir. Por eso es gris y chico:
 *    si compitiera con el campo, sería ruido.
 */
export default function ShiftDayHint({ value }: { value: string }) {
  if (!value) return null;

  const iso = localInputToArgentinaISO(value);
  const dia = formatShiftDayLong(iso);
  // Un `datetime-local` a medio completar (el usuario abrió el selector y lo
  // cerró) produce una fecha inválida. Ahí no hay nada que confirmar, y un
  // "Invalid Date" en pantalla es peor que no mostrar nada.
  if (dia.toLowerCase().includes("invalid")) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/55">
      <CalendarIcon size={13} className="text-ink/35" />
      {dia} · {formatShiftTime(iso)}
    </span>
  );
}
