# Ensayo general automático de la app (#PENDIENTE)

**Antes:** las reglas del producto se probaban por partes (tests del backend,
pantallas con la API simulada). No había un recorrido de punta a punta, con
todos los roles, sobre la app real.

**Después:** `tools/e2e-local/ensayo/` trae diez escenarios (un archivo cada
uno) y `ensayo.mjs`, que los corre todos o uno (`--solo B`) contra la pila
local, con la verificación obligatoria y la pregunta «¿Seguís disponible?»
prendidas como en producción. Cada paso sale con ✓ o ✗, y al final deja un
informe en Markdown y las capturas en `$E1_DIR` (fuera del repo). Termina con
código 1 si algo falla. No arregla nada: lo que no se cumple es un hallazgo.

**Primera corrida (2026-11-27):** 235 pasos bien, 4 fallas y 2 sin cubrir.
Cumplen: verificación para ser elegido, tope de dos cancelaciones sin peso,
«No se presentó» desde los 10 minutos, ausencia automática a las 2 horas,
escalada del urgente a los 8 minutos, 404 de todo lo ajeno y «Ver como» sólo
lectura. Las cuatro fallas están en el tablero y se arreglan en otro cambio.

**No cubre:** avisos reales en el celular, Mercado Pago, ubicación real,
entrega real de mails, eventos de varios puestos, favoritos y planes. La
calidad visual la deja en capturas: hay que mirarlas.
