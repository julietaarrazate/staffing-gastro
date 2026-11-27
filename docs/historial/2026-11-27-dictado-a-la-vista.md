# El dictado se ve mientras se habla y pide revisarlo (#757)

**Antes:** en «Describilo y lo completamos» (publicar un turno), al dictar por
voz no se veía nada hasta terminar, y si el micrófono fallaba (sin permiso, o
no se oía) se apagaba sin decir por qué. Julieta, 2026-11-27: «por voz no lo
toma bien, se confunde».

**Causa:** la voz la transcribe el dictado del navegador (Web Speech API), no
el modelo. Con números y horarios se equivoca, y el texto ya equivocado es lo
que después lee el modelo.

**Después:** lo que se va entendiendo aparece en vivo junto a «Escuchando…»;
al terminar queda en el renglón con el aviso «Revisá lo que escuchamos y
corregilo si hace falta», que se va al editarlo o al tocar «Completar». Si no
hay permiso de micrófono o no se oyó nada, la pantalla lo dice. Sigue sin
publicar nada solo.

**Queda:** el dictado del navegador no existe en iPhone (Safari) y su calidad
no depende de Oído. La mejora de fondo es mandarle el audio al modelo, previa
verificación del cupo gratis y del texto de `/privacidad` (la voz es un dato
personal).

**Cómo:** `frontend/lib/use-voice-dictation.ts` (`interim`, `error`),
`frontend/app/shifts/new/page.tsx`.

**Pruebas:** `frontend/e2e/shift-ai-parse.spec.ts` (2 casos nuevos, con un
reconocimiento de voz de mentira).
