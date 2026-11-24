# Chats, Asistente y Soporte en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglones 14, 16 y 17 de `docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** se miraron las tres pantallas renderizadas a 1440 px (y 768 y 1024), de los dos roles, en claro y oscuro. Chats y Soporte ya estaban bien (Chats con la lista de 380 px y la conversación al lado, burbujas de ~460 px; Soporte con la lista de 544 px y el ticket en ancho de lectura): no se tocó su código y se les agregó la prueba de disposición (`e2e/chats-suave.spec.ts`, `e2e/favoritos-soporte-suave.spec.ts`). El Asistente (`frontend/app/assistant/page.tsx`) era una columna de celular de 448 px en el medio: desde `md` mide `--app-reading`, las burbujas llegan a 560 px como mucho y el campo de escribir queda en esa columna (prueba en `e2e/ai-assistant-fab.spec.ts`). El celular (390 px) no cambió.

**Por qué así:** una conversación se lee mejor con renglones de ~560 px; ensancharla al marco de 1024 px habría dado líneas largas.

**Queda abierto:** el Asistente sigue en la piel vieja (sin cielo ni hoja de la dirección suave); migrarlo es otro cambio.
