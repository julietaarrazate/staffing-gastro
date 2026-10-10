# La sección de confianza de la landing deja de ser un formulario

**Pedido:** Julieta, 2026-10-10, en el hilo "Identidad de marca de Oído",
con una captura del teléfono: "Siento que parece todo un texto largo como un
formulario y no tiene tanto que ver con la landing y la app".

**Qué cambió** (`frontend/components/landing/story/Confianza.tsx`):
- Antes eran ocho renglones etiqueta/dato (cuatro por lado) con línea fina
  entre cada uno. Ahora cada lado tiene **una pieza del producto** y dos
  reglas cortas con ícono.
- "Si tenés un local": la ficha de Lucía, la misma de la historia (avatar,
  "Identidad verificada", 4,9 de reseñas, 96% puntual, 23 turnos) y una
  línea que dice que el DNI y la selfie los revisa una persona.
- "Si trabajás": la ficha de Tu bar con "Comercio verificado" y el pago
  ("Te paga directo · $70.000 por el turno · Sin comisión") en tinta, con el
  mismo tratamiento que los precios de los planes. La primera versión lo
  tenía en celeste sólido y Julieta pidió sacarlo "para que no quede todo
  tan celeste nuevamente".
- La sección deja el fondo `bg-paper` (que en la paleta celeste es
  celeste grisáceo) y queda sobre el lienzo, como "Precios".
- Las reglas que quedan como texto: no-show sin volver a publicar, urgente a
  los 8 minutos, ubicación sólo cuando la prendés y postulaciones que se
  bajan solas. El texto total bajó a la mitad.

Todas siguen siendo reglas reales del producto (ADR-0007, 0009, 0010, 0013,
0014). Los datos de Lucía salen de `fixtures.ts`, así que no pueden
contradecir lo que se vio más arriba en la historia.
