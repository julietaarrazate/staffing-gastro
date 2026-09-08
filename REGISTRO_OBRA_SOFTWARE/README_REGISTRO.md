# REGISTRO_OBRA_SOFTWARE — Índice del paquete
## Expediente de registro de obra de software — Oído

**Autora:** Julieta Arrazate
**Repositorio:** staffing-gastro (privado)
**Fecha:** Septiembre 2026

---

## 1. QUÉ ES ESTA CARPETA

Esta carpeta contiene el expediente completo para inscribir **Oído** como obra de software ante la Dirección Nacional del Derecho de Autor (DNDA, Argentina), bajo la Ley 11.723 (Art. 1, incluido por Decreto 165/94).

**Todos los datos técnicos de estos documentos provienen directamente del código fuente real del sistema; no se inventaron ni supusieron funcionalidades.** Los únicos campos sin completar son datos personales/contractuales que sólo la autora puede aportar (`EVIDENCIA_AUTORIA.md` §7) y las capturas de pantalla reales, que la autora tomará desde su cuenta de producción (`DNDA_CAPTURAS.md`).

## 2. ESTRUCTURA DEL PAQUETE

### Grupo A — Documentos imprescindibles (van al organismo)

| # | Documento | Contenido |
|---|---|---|
| 1 | `MEMORIA_DESCRIPTIVA.md` | Descripción formal de la obra — documento central del registro |
| 2 | `EVIDENCIA_AUTORIA.md` | Acredita la autoría exclusiva |
| 3 | `INVENTARIO_TECNICO.md` | Estructura y componentes técnicos |
| 4 | `DOCUMENTACION_TECNICA.md` | Arquitectura, seguridad, tiempo real, integraciones |
| 5 | `MANUAL_FUNCIONAL.md` | Casos de uso y operación |
| 6 | `MODULOS_DEL_SISTEMA.md` | Detalle de los 17 módulos funcionales |
| 7 | `ACTIVOS_PI.md` | Originalidad: algoritmos y reglas propias |
| 8 | `RESUMEN_EJECUTIVO.md` | Síntesis para evaluadores no técnicos |

### Grupo B — Documentos de respaldo (refuerzan el expediente)

| # | Documento | Contenido |
|---|---|---|
| 9 | `CARATULA_EXPEDIENTE.md` | Portada resumida en formato tabla |
| 10 | `EXPEDIENTE_FINAL.md` | Portada completa, índice y declaración de presentación |
| 11 | `REVISION_EXPEDIENTE.md` | Auditoría de coherencia interna del expediente |
| 12 | `REVISION_AUTORIA_FINAL.md` | Verificación de ausencia de referencias a terceros |
| 13 | `NOMBRE_DE_OBRA_RECOMENDADO.md` | Justificación del nombre de la obra |
| 14 | `VERSION_A_REGISTRAR.md` | Commit y tag de la versión registrada |
| 15 | `MATERIAL_COMPLEMENTARIO.md` | Guía de diagramas técnicos |
| 16 | `DNDA_OBRA_PRESENTABLE.md` | Identificación formal de la obra presentable |
| 17 | `DNDA_INCLUIR.md` | Qué incluir en el paquete de código |
| 18 | `DNDA_EXCLUSIONES.md` | Qué excluir por seguridad/privacidad |
| 19 | `DNDA_PRIVACIDAD.md` | Auditoría de datos personales |
| 20 | `DNDA_CAPTURAS.md` | Guía de capturas de pantalla a tomar |

### Grupo C — Guías operativas internas (no se entregan al organismo)

| # | Documento | Contenido |
|---|---|---|
| 21 | `TAG_REGISTRO.md` | Instrucciones para crear el tag git de registro |
| 22 | `PAQUETE_FINAL.md` | Qué incluir/excluir del ZIP final |
| 23 | `CHECKLIST_PRESENTACION.md` | Checklist paso a paso para presentar |
| 24 | `ESTADO_FINAL_REGISTRO.md` | Estado de preparación del expediente |
| 25 | `DNDA_FORMATO_PRESENTACION.md` | Cómo adaptar el paquete al portal de la DNDA |
| 26 | `DNDA_VERSION_REGISTRADA.md` | Identificación exacta de la versión (hash, tag) |
| 27 | `DNDA_REVISION_EXPEDIENTE.md` | Auditoría integral de los 31 documentos |
| 28 | `DNDA_ESTRUCTURA_ZIP.md` | Estructura exacta del ZIP de depósito del código |
| 29 | `DNDA_VALIDACION_FINAL.md` | Verificación de cumplimiento de todos los requisitos |
| 30 | `DNDA_CHECKLIST_FINAL.md` | Checklist operativo final, con tiempos estimados |

## 3. CÓMO USAR ESTE PAQUETE

1. Leer `ESTADO_FINAL_REGISTRO.md` para saber qué falta completar.
2. Completar el campo `[COMPLETAR]` de `EVIDENCIA_AUTORIA.md` §7.
3. Tomar las capturas de pantalla según `DNDA_CAPTURAS.md`.
4. Seguir `CHECKLIST_PRESENTACION.md` (o su versión ampliada `DNDA_CHECKLIST_FINAL.md`) paso a paso.
5. Presentar según `DNDA_FORMATO_PRESENTACION.md` (adaptado a las restricciones reales del portal de la DNDA).

## 4. RESUMEN DE LA OBRA

| Campo | Dato |
|---|---|
| Nombre de la obra | Oído |
| Repositorio técnico | staffing-gastro (privado) |
| Autora | Julieta Arrazate |
| Tipo de obra | Programa de computación (Ley 11.723, Art. 1) |
| Commits en el repositorio | 303 |
| Backend | 17 routers, 14 modelos, 30 migraciones, 429 tests |
| Frontend | 31 páginas, 87 componentes, 75 tests E2E |
| Decisiones de arquitectura documentadas | 11 ADRs |
| Estado | Producción, beta cerrada con usuarios reales |

---

*Índice del paquete de registro — Julieta Arrazate — Septiembre 2026*
