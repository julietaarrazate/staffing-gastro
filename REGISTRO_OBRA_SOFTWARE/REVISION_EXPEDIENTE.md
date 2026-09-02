# REVISIÓN DEL EXPEDIENTE DE REGISTRO
## Auditoría de los documentos generados — Oído

**Fecha de revisión:** Septiembre 2026
**Documentos auditados:** los generados en `REGISTRO_OBRA_SOFTWARE/`

---

## 1. HALLAZGOS CRÍTICOS (requieren corrección antes de presentar)

### 1.1 Comparación con productos de terceros en `MEMORIA_DESCRIPTIVA.md` — CORREGIDO

| Archivo | Problema | Estado |
|---|---|---|
| `MEMORIA_DESCRIPTIVA.md` | Una redacción preliminar comparaba el modelo de interacción del producto con dos aplicaciones de terceros ampliamente conocidas | **CORREGIDO** — reemplazado por una descripción funcional neutral, sin nombrar productos ni empresas de terceros |

### 1.2 Campos marcados `[COMPLETAR]` — PENDIENTES DE LA AUTORA

Sólo en `EVIDENCIA_AUTORIA.md`, sección 7. Tres campos que nadie puede completar excepto la autora:

| Campo | Descripción | Impacto si no se completa |
|---|---|---|
| Fecha de inicio del desarrollo | Si hay evidencia de trabajo previo al primer commit (21 de junio de 2026) | Menor: el repositorio ya acredita la fecha del primer commit |
| Evidencia de desarrollo previo | Bocetos, prototipos o especificaciones anteriores al repositorio | Menor: sólo fortalece el expediente |
| Contexto laboral/contractual | Declarar si hubo relación de dependencia laboral durante el desarrollo | **Importante:** necesario para descartar cesión implícita de derechos |

**Recomendación:** completar el campo de contexto laboral/contractual antes de presentar. Los otros dos son opcionales.

## 2. HALLAZGOS MODERADOS (correctos técnicamente, conviene tenerlos presentes)

### 2.1 Menciones de proveedores de infraestructura y tecnología

| Servicio | Documentos que lo mencionan | Evaluación |
|---|---|---|
| Google (login, Gemini) | `INVENTARIO_TECNICO`, `DOCUMENTACION_TECNICA`, `RESUMEN_EJECUTIVO` | Correcto: dependencias técnicas reales del sistema |
| Vercel | `INVENTARIO_TECNICO`, `RESUMEN_EJECUTIVO` | Correcto: plataforma de deploy del frontend |
| Render | `INVENTARIO_TECNICO`, `RESUMEN_EJECUTIVO` | Correcto: plataforma de deploy del backend |
| Neon | `INVENTARIO_TECNICO`, `DOCUMENTACION_TECNICA` | Correcto: proveedor de base de datos |
| Cloudinary | `DOCUMENTACION_TECNICA`, `MODULOS_DEL_SISTEMA` | Correcto: almacenamiento de imágenes/archivos |
| Resend | `DOCUMENTACION_TECNICA` | Correcto: email transaccional |
| Sentry | `DOCUMENTACION_TECNICA` | Correcto: monitoreo de errores, opt-in |
| Mercado Pago | `MODULOS_DEL_SISTEMA`, `DOCUMENTACION_TECNICA` | Correcto: pasarela de pagos, construida y no activada |
| MapLibre / Nominatim-OpenStreetMap | `INVENTARIO_TECNICO`, `MODULOS_DEL_SISTEMA` | Correcto: mapas y geocoding, sin costo |

**Veredicto:** estas menciones son técnicamente apropiadas y necesarias para describir la arquitectura del sistema. No revelan secretos comerciales ni implican coautoría.

### 2.2 Nombres de comercio en datos de demostración

La documentación menciona, a título de ejemplo, la convención de nombres genéricos usada en los datos de demostración (categoría + barrio, por ejemplo "Bar Palermo Soho"). Ninguno corresponde a un comercio real.

**Veredicto:** correcto, no identifica a ningún tercero real.

## 3. HALLAZGOS MENORES (mejoras opcionales)

### 3.1 Redundancia entre documentos

| Información | Aparece en |
|---|---|
| Tabla de 17 módulos | `MEMORIA_DESCRIPTIVA` + `MODULOS_DEL_SISTEMA` (versión extendida) |
| Stack tecnológico | `INVENTARIO_TECNICO` + `RESUMEN_EJECUTIVO` + `DOCUMENTACION_TECNICA` |
| Estadísticas del repositorio (303 commits) | `EVIDENCIA_AUTORIA` + `README_REGISTRO` |
| Motor de matching | `MEMORIA_DESCRIPTIVA` + `ACTIVOS_PI` + `DOCUMENTACION_TECNICA` |

**Veredicto:** la redundancia es intencional y apropiada para un expediente: cada documento debe poder presentarse por separado. No es un defecto.

## 4. INFORMACIÓN SENSIBLE: RESULTADO FINAL

| Tipo de información | ¿Presente? | Observación |
|---|---|---|
| Claves / tokens / contraseñas | NO | Correcto |
| Variables de entorno con valores reales | NO | Sólo se mencionan los nombres de las variables |
| Nombres de comercios o trabajadores reales de la beta | NO | Correcto |
| Nombres de competidores usados como comparación | 1 corregido | Corregido en `MEMORIA_DESCRIPTIVA.md` |
| Datos de producción (URLs privadas, IDs de infraestructura) | NO | Correcto |
| Información de terceros identificables | NO | Correcto |

## 5. RESUMEN EJECUTIVO DE LA AUDITORÍA

| Estado | Cantidad | Descripción |
|---|---|---|
| Crítico corregido | 1 | Comparación con productos de terceros → reemplazada por descripción neutral |
| Pendiente manual | 1 | Campo contractual/laboral en `EVIDENCIA_AUTORIA.md` §7 |
| Sin acción necesaria | Todo lo demás | El expediente está limpio |

**Conclusión:** el expediente es presentable. Sólo resta que la autora complete el campo contractual/laboral de `EVIDENCIA_AUTORIA.md` y tome las capturas de pantalla reales según `DNDA_CAPTURAS.md`.

---

*Auditoría realizada sobre el material existente. Julieta Arrazate — Septiembre 2026*
