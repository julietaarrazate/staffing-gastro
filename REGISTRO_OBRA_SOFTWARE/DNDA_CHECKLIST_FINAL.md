# CHECKLIST FINAL DE PRESENTACIÓN
## Pasos operativos para completar y presentar ante DNDA — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026
**Obra:** Oído

---

## 0. VERIFICACIÓN PREVIA

- [ ] Acceso al repositorio `staffing-gastro`
- [ ] Los 30-31 archivos `.md` en `REGISTRO_OBRA_SOFTWARE/` presentes
- [ ] Acceso para tomar capturas del sistema real en producción
- [ ] Acceso a una herramienta de diagramas (Excalidraw, draw.io, Figma)
- [ ] Tiempo estimado: 3-4 horas de trabajo activo, más la espera de la DNDA

### 0.1 Tipo de trámite — información oficial

- **Trámite:** Inscripción de obra publicada — Software.
- **Opción elegida:** Digital (el código se sube después de la comunicación de la DNDA).
- **Pagos obligatorios previos al inicio:** arancel $3.800 + tasa 0,2% del valor declarado (mínimo $4,11).
- **Silencio positivo:** 60 días hábiles desde la acreditación de condiciones.

### 0.2 Pagos previos (antes del Paso 1)

- [ ] Pagar el arancel del trámite ($3.800)
- [ ] Guardar comprobante como `COMPROBANTE_PAGO_TRAMITE.pdf`
- [ ] Pagar la tasa (0,2% del valor declarado, mínimo $4,11)
- [ ] Guardar comprobante como `COMPROBANTE_PAGO_TASA.pdf`

---

## FASE 1: CAPTURAS DE PANTALLA (30-60 minutos)

Tomar las capturas listadas en `DNDA_CAPTURAS.md`, en orden de prioridad Alta primero, desde el sistema real en producción (https://staffing-gastro.vercel.app).

- [ ] Grupo A (autenticación/onboarding) — 4 capturas
- [ ] Grupo B (experiencia del trabajador) — 9 capturas
- [ ] Grupo C (experiencia del comercio) — 9 capturas
- [ ] Grupo D (administración) — 3 capturas
- [ ] Grupo E (ciclo del turno en vivo) — 2 capturas
- [ ] Mover las capturas a la carpeta `CAPTURAS/` con la nomenclatura indicada
- [ ] Difuminar cualquier dato de un trabajador/comercio real de la beta que aparezca sin querer

---

## FASE 2: DIAGRAMAS DE ARQUITECTURA (1-2 horas)

- [ ] `arquitectura_sistema.png` — ver especificación en `MATERIAL_COMPLEMENTARIO.md` §2.1
- [ ] `base_de_datos_er.png` — ver §2.2
- [ ] `ciclo_de_vida_turno.png` — ver §2.3
- [ ] `flujo_matching.png` — ver §2.4
- [ ] Guardar los 4 en `DIAGRAMAS/`

---

## FASE 3: GENERACIÓN DE PDFs (30 minutos)

### 3.1 Los 8 PDFs principales

- [ ] `MEMORIA_DESCRIPTIVA.pdf`
- [ ] `INVENTARIO_TECNICO.pdf`
- [ ] `DOCUMENTACION_TECNICA.pdf`
- [ ] `MANUAL_FUNCIONAL.pdf`
- [ ] `MODULOS_DEL_SISTEMA.pdf`
- [ ] `EVIDENCIA_AUTORIA.pdf`
- [ ] `ACTIVOS_PI.pdf`
- [ ] `RESUMEN_EJECUTIVO.pdf`

**Verificar cada PDF:** abre sin errores, texto en español con acentos correctos, tablas bien formateadas.

### 3.2 PDF opcional: extracto de código fuente

- [ ] `CODIGO_FUENTE_EXTRACTO.pdf` con `matching/domain/scoring.py`, `verification/domain/services.py`, `worker/domain/rules.py`, `assistant/application/services.py`

---

## FASE 4: CREAR EL ARCHIVO ZIP (30 minutos)

- [ ] Crear `INDICE_CONTENIDO.txt` (ver plantilla en `DNDA_ESTRUCTURA_ZIP.md` §3)
- [ ] Crear el ZIP según el comando de `PAQUETE_FINAL.md` §4
- [ ] Verificar contenido: `unzip -l EXPEDIENTE_DNDA_OIDO_2026_09.zip | head -50`
- [ ] Verificar tamaño: `du -sh EXPEDIENTE_DNDA_OIDO_2026_09.zip` (esperado ~27-35 MB)
- [ ] Verificar integridad: `unzip -t EXPEDIENTE_DNDA_OIDO_2026_09.zip`
- [ ] Verificar ausencia de archivos sensibles: `unzip -l ... | grep -E "\.env|node_modules|__pycache__|\.git"` (esperado: vacío)

---

## FASE 5: INICIAR EL TRÁMITE ONLINE EN EL PORTAL DNDA (1 hora)

### 5.1 Ir al portal y completar el formulario

- [ ] Ir a **tramites.argentina.gob.ar** → buscar "Inscripción de obra publicada - Software"
- [ ] Iniciar sesión con CUIL/CUIT en Mi Argentina
- [ ] Seleccionar: "Inscripción de obra publicada — Software" → opción **Digital**

### 5.2 Completar los datos del trámite

- [ ] **Nombre de la obra:** Oído
- [ ] **Tipo de obra:** Programa de computación
- [ ] **Autora:** Julieta Arrazate
- [ ] **Email:** julietaarrazate@gmail.com
- [ ] **DNI:** 36.316.081
- [ ] **Nacionalidad:** Argentina
- [ ] **Domicilio:** [completar con domicilio real]
- [ ] **Teléfono:** [completar]
- [ ] **Año de publicación:** 2026

### 5.3 Subir documentación obligatoria (Paso 1)

- [ ] `COMPROBANTE_PAGO_TRAMITE.pdf`
- [ ] `COMPROBANTE_PAGO_TASA.pdf`
- [ ] `DNI_ARRAZATE.pdf`/`.jpg`
- [ ] `MEMORIA_DESCRIPTIVA.pdf`
- [ ] `EVIDENCIA_AUTORIA.pdf`
- [ ] `INVENTARIO_TECNICO.pdf`
- [ ] `DOCUMENTACION_TECNICA.pdf`
- [ ] `MANUAL_FUNCIONAL.pdf`
- [ ] `MODULOS_DEL_SISTEMA.pdf`
- [ ] `ACTIVOS_PI.pdf`
- [ ] `RESUMEN_EJECUTIVO.pdf`
- [ ] `CAPTURAS.pdf` (capturas consolidadas)

### 5.4 Confirmar y guardar el número de expediente

- [ ] Confirmar presentación → se genera el Expediente Electrónico
- [ ] Anotar número de expediente: ___________________________
- [ ] Guardar la carátula del expediente y el email de confirmación

### 5.5 Esperar la comunicación de la DNDA (Paso 2)

- [ ] Aguardar el email con instrucciones de carga digital del código
- [ ] Subir el ZIP preparado en la Fase 4 según esas instrucciones
- [ ] (Opcional) cifrar el ZIP con contraseña antes de subirlo

---

## FASE 6: CHECKLIST FINAL PRE-PRESENTACIÓN

- [ ] ZIP existe y es accesible
- [ ] Contiene las capturas reales en `CAPTURAS/`
- [ ] Contiene los 4 diagramas en `DIAGRAMAS/`
- [ ] Contiene los 8-9 PDFs en `DOCUMENTACION/`
- [ ] Contiene el código fuente íntegro en `SOFTWARE/`
- [ ] Contiene los 30-31 `.md` en `SOFTWARE/REGISTRO_OBRA_SOFTWARE/`
- [ ] Contiene `INDICE_CONTENIDO.txt`
- [ ] Sin archivos `.env` reales, `.pem`, `.key`, `node_modules`, `__pycache__`
- [ ] Formulario DNDA completado
- [ ] Copia de DNI incluida

---

## FASE 7: CARGA DIGITAL DEL CÓDIGO (Paso 2 — tras email DNDA)

- [ ] Verificar bandeja de entrada (y spam)
- [ ] Seguir exactamente las instrucciones del email de la DNDA
- [ ] Subir el ZIP por el canal indicado
- [ ] Guardar confirmación de recepción del Paso 2
- [ ] Anotar número de expediente, fecha de inicio (Paso 1) y fecha de carga de código (Paso 2)
- [ ] **Silencio positivo:** 60 días hábiles desde la acreditación de condiciones — si no hay respuesta, el registro se considera otorgado (Ley 19.549, Art. 10 inciso b)

---

## TIMELINE RECOMENDADO

| Fase | Duración |
|---|---|
| Pagos previos | 0.5 horas |
| Fase 1: Capturas | 0.5-1 hora |
| Fase 2: Diagramas | 1-2 horas |
| Fase 3: PDFs | 0.5 horas |
| Fase 4: ZIP | 0.5 horas |
| Fase 5: Iniciar trámite online | 1 hora |
| Fase 6: Checklist pre-carga | 0.5 horas |
| Fase 7: Carga código (Paso 2) | Variable — depende de la DNDA |
| **TOTAL activo** | **~4.5-6.5 horas + espera de la DNDA** |

---

## CONTACTO DNDA

**Dirección Nacional del Derecho de Autor (Argentina)**

- **Portal de trámites:** tramites.argentina.gob.ar
- **Sitio institucional:** argentina.gob.ar/dnda
- **Domicilio (opción física, no elegida):** Moreno 1230, Ciudad Autónoma de Buenos Aires — 9:30 a 14:30 hs.

---

## NOTAS FINALES

- **Tiempo total activo:** ~4.5-6.5 horas de trabajo, más la espera del email de la DNDA (días).
- **Costo:** $3.800 (arancel) + 0,2% del valor declarado de la obra (tasa).
- **Plazo de respuesta:** 60 días hábiles (silencio positivo).
- **Código cifrado:** opción válida (Disposición 2-E/2016); la autora debe poder proveer la clave si una autoridad lo requiere.

---

*Checklist final de presentación para expediente DNDA — Julieta Arrazate — Septiembre 2026*
