import { cobroParaElComercio } from "@/lib/cobro";
import type { Shift } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

/** Lo que dijo la persona del cobro, en el turno del comercio. Nada si no dijo
 * nada. Un solo ámbar por pantalla: el aviso va en tinta, no en amarillo. */
export default function CobroEnElTurno({ shift }: { shift: Shift }) {
  const cobro = cobroParaElComercio(shift);
  if (!cobro) return null;
  return cobro.tono === "ok" ? (
    <p
      data-testid="cobro-del-turno"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-text"
    >
      <CheckIcon size={16} /> {cobro.texto}
    </p>
  ) : (
    <p data-testid="cobro-del-turno" className="text-sm font-semibold text-ink">
      {cobro.texto}. Si ya le pagaste, pedile que lo confirme; si no, coordinalo por el chat.
    </p>
  );
}
