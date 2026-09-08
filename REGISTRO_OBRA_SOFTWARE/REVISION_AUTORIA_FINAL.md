# REVISIÓN DE AUTORÍA FINAL
## Verificación de referencias a terceros en el expediente

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026
**Alcance:** Todos los documentos de `REGISTRO_OBRA_SOFTWARE/`

---

## 1. METODOLOGÍA

Se realizó una revisión de todos los documentos del expediente buscando:

- Nombres de personas físicas distintas a la autora.
- Nombres de comercios o clientes reales del sistema.
- Nombres de empresas competidoras usadas como comparación de producto.
- Referencias a asesores, consultores o validadores funcionales.
- Referencias a socios comerciales o inversores.
- Atribución de autoría creativa a terceros.

## 2. RESULTADOS

### 2.1 Personas físicas

| Persona mencionada | Rol en el documento | ¿Problema? |
|---|---|---|
| Julieta Arrazate | Autora de la obra | No — es la autora |

**Ninguna otra persona física aparece en el expediente.**

### 2.2 Comercios y "clientes" del sistema

Oído es un marketplace de dos lados (comercios y trabajadores); no tiene "clientes" en el sentido contable de la palabra. Los nombres de comercio que aparecen en el sistema son datos de demostración generados para poblar el entorno de desarrollo/beta (por ejemplo "Bar Palermo Soho", "Café Núñez", "Pizzería Almagro"): combinaciones genéricas de categoría gastronómica + barrio de Buenos Aires, sin corresponder a ningún comercio real existente. No se detectó ningún nombre de comercio real en la documentación del expediente.

### 2.3 Empresas competidoras usadas como comparación

**Un hallazgo fue detectado y corregido:** una redacción preliminar de `MEMORIA_DESCRIPTIVA.md` describía el modelo de interacción del producto comparándolo con dos aplicaciones de terceros ampliamente conocidas, por analogía de patrón de producto (no por relación real ni por uso de su código o marca). Se corrigió reemplazando la comparación por una descripción funcional neutral del propio sistema, sin nombrar productos ni empresas de terceros.

### 2.4 Proveedores de infraestructura y herramientas de desarrollo

Los servicios técnicos de terceros mencionados en la documentación técnica (motor de base de datos serverless, plataformas de despliegue, servicio de email transaccional, servicio de imágenes, proveedor de modelo de lenguaje, pasarela de pagos, servicio de monitoreo de errores, servicio de mapas/geocoding) son **proveedores de infraestructura y herramientas de desarrollo** cuya mención es técnicamente necesaria para describir la arquitectura real del sistema. No implica participación en la autoría de la obra ni relación comercial más allá del uso de sus APIs públicas bajo los términos de servicio estándar.

### 2.5 Asesores, consultores o validadores funcionales

No se encontraron referencias a personas que hayan asesorado, validado o aprobado funcionalidades del sistema.

### 2.6 Socios comerciales

No se encontraron referencias a socios comerciales, inversores, co-fundadores ni participantes en la explotación de la obra.

### 2.7 Roles técnicos del sistema (`worker`, `employer`, `admin`)

Las palabras "trabajador", "comercio" y "administrador" aparecen múltiples veces en toda la documentación. En todos los casos se refieren a los roles técnicos del sistema (`worker`/`employer`/`admin`, enum `UserRole` en el código), no a ninguna persona física identificada.

## 3. PALABRAS CLAVE AUDITADAS

| Término buscado | Apariciones encontradas | Todas legítimas |
|---|---|---|
| Nombres propios de personas | 0 (salvo autora) | ✅ |
| Nombres de comercios reales | 0 (sólo demo genérica) | ✅ |
| Empresas competidoras como comparación | 1 → corregido | ✅ |
| Asesores / consultores | 0 | ✅ |
| Socios / inversores | 0 | ✅ |
| Validadores / testers externos | 0 | ✅ |

## 4. CONCLUSIÓN

**El expediente está libre de referencias a terceros que puedan:**

- Generar ambigüedad sobre la autoría exclusiva de la obra.
- Atribuir participación creativa a personas que no desarrollaron software.
- Exponer relaciones comerciales o contractuales.
- Identificar comercios, clientes, asesores, competidores o validadores funcionales por nombre.

La documentación describe únicamente la obra informática, su arquitectura, sus funcionalidades y su autoría.

**La autoría de la obra corresponde exclusivamente a Julieta Arrazate.**

---

*Auditoría realizada sobre el material del expediente. Julieta Arrazate — Septiembre 2026*
