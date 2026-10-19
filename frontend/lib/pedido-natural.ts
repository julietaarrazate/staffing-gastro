/**
 * Lee un pedido escrito como se habla ("necesito un mozo hoy de 21 a 2, pago
 * 70.000") y saca el puesto, el día, el horario y el pago. Lo usa la comanda
 * de la landing (components/landing/Comanda.tsx), que corre sin sesión y sin
 * llamar al backend: es una demostración. El pedido real lo lee la IA de
 * `POST /shifts/parse-text` dentro de la app.
 *
 * Sólo reconoce lo que encuentra; lo que falta queda `undefined` y la comanda
 * lo muestra como "A coordinar".
 */
export type PedidoLeido = {
  puesto?: string;
  cantidad?: number;
  dia?: string;
  horario?: string;
  pago?: string;
};

const PUESTOS: [RegExp, string][] = [
  [/\b(moz[oa]s?|meser[oa]s?|camarer[oa]s?)\b/, "Mozo/a"],
  [/\b(bartenders?|barm[aá]n|barra)\b/, "Bartender"],
  [/\b(bacher[oa]s?|bacha|lavaplatos)\b/, "Bachero/a"],
  [/\bbaristas?\b/, "Barista"],
  [/\b(cociner[oa]s?|cocina|parriller[oa]s?|ayudante de cocina|chef)\b/, "Cocina"],
  [/\brunners?\b/, "Runner"],
  [/\b(cajer[oa]s?|caja)\b/, "Cajero/a"],
  [/\bsommeliers?\b/, "Sommelier"],
  [/\b(recepcionista|host(ess)?)\b/, "Recepción"],
];

// "pasado mañana" antes que "mañana", así no se queda con la palabra corta.
const DIAS: [RegExp, string][] = [
  [/\bhoy\b/, "Hoy"],
  [/\bpasado mañana\b/, "Pasado mañana"],
  [/\bmañana\b/, "Mañana"],
  [/\blunes\b/, "Lunes"],
  [/\bmartes\b/, "Martes"],
  [/\bmi[eé]rcoles\b/, "Miércoles"],
  [/\bjueves\b/, "Jueves"],
  [/\bviernes\b/, "Viernes"],
  [/\bs[aá]bado\b/, "Sábado"],
  [/\bdomingo\b/, "Domingo"],
  [/\bfinde\b/, "El finde"],
];

const NUMEROS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };

const hora = (h: string, m?: string) => `${String(Number(h) % 24).padStart(2, "0")}:${m ?? "00"}`;

export function leerPedido(texto: string): PedidoLeido {
  const t = texto.toLowerCase();
  const leido: PedidoLeido = {};

  leido.puesto = PUESTOS.find(([re]) => re.test(t))?.[1];
  leido.dia = DIAS.find(([re]) => re.test(t))?.[1];

  const rango = t.match(
    /(?:de|desde)\s*(?:las\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?)?\s*(?:a|hasta)\s*(?:las\s*)?(\d{1,2})(?:[:.](\d{2}))?/
  );
  if (rango) leido.horario = `${hora(rango[1], rango[2])} – ${hora(rango[3], rango[4])}`;

  // "80 mil" / "80k" primero; si no, un número de 4 o más cifras ("70.000").
  const conMil = t.match(/(\d+(?:[.,]\d+)?)\s*(?:k|mil)\b/);
  const numero = t.match(/\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,7})(?!\s*(?:hs|:))/);
  const pago = conMil
    ? Math.round(parseFloat(conMil[1].replace(",", ".")) * 1000)
    : numero
      ? parseInt(numero[1].replace(/\./g, ""), 10)
      : undefined;
  if (pago) leido.pago = `$${pago.toLocaleString("es-AR")}`;

  const cuantos = t.match(
    /\b(\d|un[oa]?|dos|tres|cuatro|cinco)\s+(?:moz|meser|camarer|bartender|barm|bacher|barista|cociner|ayudante|runner|cajer|parriller)/
  );
  const cantidad = cuantos ? (NUMEROS[cuantos[1]] ?? Number(cuantos[1])) : 1;
  if (cantidad > 1) leido.cantidad = cantidad;

  return leido;
}
