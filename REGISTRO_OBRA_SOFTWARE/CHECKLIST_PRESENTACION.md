# CHECKLIST DE PRESENTACIÓN
## Lista de verificación paso a paso — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## FASE 1 — PREPARACIÓN DEL EXPEDIENTE

### 1.1 Completar campos obligatorios

- [ ] **Contexto laboral/contractual** — completar en `EVIDENCIA_AUTORIA.md` sección 7
  - Ejemplo: "La obra fue desarrollada con equipos propios, fuera de toda relación de dependencia laboral y sin acuerdo de confidencialidad ni cesión de derechos con terceros."
- [ ] **(Opcional)** Fecha exacta de inicio del desarrollo, si hay evidencia previa al primer commit (21 de junio de 2026)

### 1.2 Verificar que el campo `[COMPLETAR]` quedó vacío en todos los demás documentos

```bash
grep -r "\[COMPLETAR\]" REGISTRO_OBRA_SOFTWARE/
```

Sólo debe aparecer en `EVIDENCIA_AUTORIA.md` (los campos completados en el paso anterior).

---

## FASE 2 — DOCUMENTOS A EXPORTAR A PDF

| Documento | Prioridad |
|---|---|
| `MEMORIA_DESCRIPTIVA.md` | **IMPRESCINDIBLE** |
| `EVIDENCIA_AUTORIA.md` | **IMPRESCINDIBLE** |
| `INVENTARIO_TECNICO.md` | **IMPRESCINDIBLE** |
| `ACTIVOS_PI.md` | Recomendado |
| `DOCUMENTACION_TECNICA.md` | Recomendado |
| `MANUAL_FUNCIONAL.md` | Recomendado |
| `EXPEDIENTE_FINAL.md` | Recomendado |
| `RESUMEN_EJECUTIVO.md` | Complementario |
| `MODULOS_DEL_SISTEMA.md` | Complementario |

**Comando rápido con Pandoc (si está instalado):**
```bash
cd REGISTRO_OBRA_SOFTWARE
for f in MEMORIA_DESCRIPTIVA EVIDENCIA_AUTORIA INVENTARIO_TECNICO ACTIVOS_PI; do
  pandoc ${f}.md -o ${f}.pdf --pdf-engine=wkhtmltopdf
done
```

---

## FASE 3 — EXTRACTO DE CÓDIGO FUENTE

- [ ] Exportar `backend/app/modules/matching/domain/scoring.py` (motor de matching)
- [ ] Exportar `backend/app/modules/verification/domain/services.py` (verificación por niveles)
- [ ] Exportar `backend/app/modules/worker/domain/rules.py` (insignias y niveles)
- [ ] *(Opcional)* Exportar `backend/app/modules/assistant/application/services.py`
- [ ] Los PDFs de código deben incluir: nombre del archivo, numeración de líneas

**Nota DNDA:** la mayoría de organismos requiere depositar una porción representativa del código, no el código completo. 20-50 páginas impresas es suficiente.

---

## FASE 4 — CAPTURAS DE PANTALLA

- [ ] Tomar las capturas listadas en `DNDA_CAPTURAS.md` (prioridad Alta primero), desde una cuenta real de producción
- [ ] Nombrar los archivos según la nomenclatura indicada en ese documento
- [ ] Guardar en carpeta `CAPTURAS/`
- [ ] Resolución mínima: 1280×720 px
- [ ] Formato: PNG o JPG

---

## FASE 5 — DIAGRAMAS

- [ ] Crear el Diagrama de Arquitectura (ver especificación en `MATERIAL_COMPLEMENTARIO.md`)
- [ ] Crear el Diagrama de Base de Datos
- [ ] Crear el Diagrama del ciclo de vida del turno
- [ ] Crear el Diagrama de flujo del motor de matching
- [ ] Guardar en carpeta `DIAGRAMAS/`

---

## FASE 6 — HISTORIAL GIT

- [ ] Exportar el historial git a texto plano:
```bash
git log --format="%H | %ad | %an | %s" --date=short > HISTORIAL_GIT.txt
```
- [ ] Verificar que el archivo incluye el commit que incorpora `REGISTRO_OBRA_SOFTWARE/`
- [ ] Guardar en la raíz del ZIP o en la carpeta `DOCUMENTACION/`

---

## FASE 7 — ARMADO DEL ZIP

- [ ] Crear el ZIP según estructura definida en `PAQUETE_FINAL.md`
- [ ] Verificar que NO hay `.env`, `.venv`, `node_modules`, `__pycache__`, `.next`, credenciales
- [ ] Calcular el hash SHA-256 del ZIP para registro posterior:
```bash
sha256sum REGISTRO_OBRA_SOFTWARE_OIDO_2026_09.zip
```
- [ ] Guardar el hash en un archivo de texto separado como respaldo

---

## FASE 8 — CREAR EL TAG DE VERSIÓN EN GIT

- [ ] Mergear el PR de este expediente a `main`
- [ ] Crear el tag anotado (ver `TAG_REGISTRO.md` para el comando exacto)
- [ ] Verificar el tag: `git show <tag>`
- [ ] Guardar el hash completo del tag

---

## FASE 9 — PRESENTACIÓN ANTE EL ORGANISMO

- [ ] Completar formulario del organismo (DNDA)
- [ ] Abonar el arancel ($3.800) y la tasa (0,2% del valor declarado, mín. $4,11)
- [ ] Presentar (Paso 1): formulario, comprobantes de pago, DNI, PDFs de documentación
- [ ] Guardar el número de trámite / número de expediente
- [ ] Esperar comunicación de la DNDA para el Paso 2 (carga digital del código)

---

## FASE 10 — RESPALDO Y CONSERVACIÓN

- [ ] Guardar copia del ZIP en al menos 2 ubicaciones (disco externo + nube)
- [ ] Guardar los PDFs del expediente
- [ ] Guardar el hash SHA-256 del ZIP
- [ ] Guardar el hash del commit y del tag git
- [ ] Guardar el comprobante del organismo de registro
- [ ] Anotar el número de certificado cuando sea emitido

---

## RESUMEN RÁPIDO

| Estado | Acción |
|---|---|
| Completar manualmente | Contexto laboral/contractual en `EVIDENCIA_AUTORIA.md` |
| Exportar a PDF | 8-9 documentos Markdown |
| Capturar | Pantallas según `DNDA_CAPTURAS.md` |
| Comprimir | ZIP según `PAQUETE_FINAL.md` |
| Git | Crear tag de registro post-merge |
| Presentar | Ante la DNDA con formulario, PDFs y código |

---

*Checklist elaborado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
