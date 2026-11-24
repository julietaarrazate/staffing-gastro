# Escritorio: Mi plan y Favoritos del comercio ya estaban bien en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglones 6 y 8 de `docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** nada de código de producto. Se miraron `/subscription` y `/favorites` renderizadas (390, 768, 1024 y 1440 px, claro y oscuro) y las dos ya usan el marco ancho (`SubpaginaSuave ancha`, 1024 px): Mi plan pone los tres planes lado a lado desde `lg` (la tarjeta del plan actual y la baja ocupan el ancho de lectura de la hoja) y Favoritos es una grilla de dos columnas desde `lg`. Se agregaron dos pruebas de disposición con `boundingBox` (`frontend/e2e/mi-plan-suave.spec.ts`, `frontend/e2e/favoritos-soporte-suave.spec.ts`) para que no se pierda.

**Por qué así:** la regla de la etapa es no tocar por tocar. Tres columnas en Favoritos dejarían tarjetas de ~300 px con el nombre cortado; dos columnas se leen bien. Textos, precios y límites de los planes: sin tocar.

**Queda abierto:** a 768 px (tablet) Mi plan acomoda dos planes y el tercero queda solo en la segunda fila; no es compu y se dejó.
