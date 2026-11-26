# Términos: qué hace Oído, y avisar con tiempo no cuenta (#750)

**Pedido:** Julieta consultó a su abogado, que aprobó el encuadre «Oído es
sólo intermediario» con un texto largo de referencia. Pidió que los Términos
queden cortos, en el idioma de la app, y que estén antes de la beta
(2026-11-26; hoy los usuarios son personas de confianza).

**Qué cambió:**
- `/terminos` ya decía lo central (plataforma de intermediación, no es
  empleador ni parte, no garantiza, el comercio define y paga, nadie está
  obligado). Se sumaron cuatro frases: en «Qué es Oído», que Oído ordena y
  sugiere y deciden las partes; en «Cancelaciones y no-show», que si no
  marcás la llegada el comercio puede indicar si llegaste y si fue a
  horario; en «Límite de responsabilidad», que usar Oído no reemplaza las
  obligaciones legales de cada parte y que Oído responde por lo propio.
  Versión legal `2026-11-26-1` (backend y `frontend/lib/legal.ts`).
- La tarjeta «Garantía Oído» de Candidatos pasa a llamarse «Si algo falla»:
  los Términos dicen que Oído no garantiza la asistencia ni es garante.
- Avisar con 24 horas o más que no vas a un turno confirmado no suma una
  cancelación, con la reconfirmación prendida o apagada
  (`ShiftService.worker_cancel`, `cancel_with_notice` en la respuesta). Antes
  dependía de `RECONFIRMACION_ENABLED` y, apagada, la app contaba cualquier
  cancelación aunque los Términos hablaran de cancelar «muy sobre la hora».

**Por qué así:** no se copió el texto largo: repetía lo que ya estaba y en
otro registro. Se agregó sólo lo que faltaba y lo que hace que el texto
coincida con lo que la app hace.

**Queda abierto:** la app registra qué versión aceptó cada persona al crear
la cuenta, pero no le pide a quien ya tiene cuenta que acepte una versión
nueva. Antes de abrir la beta hay que decidir si hace falta. Cuando se
prenda la reconfirmación o exista la oferta directa, una frase para cada una
(borradores en el documento privado de la consulta legal).
