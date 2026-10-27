# FORMATO DE PRESENTACIÓN EN EL PORTAL DNDA
## Adaptación del expediente a las restricciones del sistema de carga — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026
**Obra:** Oído
**Tipo de trámite DNDA:** Inscripción de obra publicada — Software

---

## 0. PROCESO OFICIAL — OPCIÓN DIGITAL (DOS PASOS)

La opción **digital** del portal tiene **dos pasos distintos**:

### PASO 1 — Portal online

Subir en el portal:
1. **Datos del trámite** (formulario online completo).
2. **Comprobante de pago del trámite** — $3.800 (obligatorio).
3. **Comprobante de pago de Tasa** — 0,2% del valor del ejemplar, mínimo $4,11 (obligatorio).
4. **Documentación técnica** (PDFs de memoria, inventario, capturas, etc.).

Al finalizar el Paso 1, la DNDA genera automáticamente un **número de Expediente Electrónico** (carátula).

### PASO 2 — Carga digital del código (tras comunicación de la DNDA)

Una vez iniciado el expediente, la DNDA envía una **comunicación por email** con el procedimiento para la **carga digital de la obra** (el código fuente).

> La DNDA acepta que el código fuente se suba de modo **cifrado/encriptado**
> (Disposición 2-E/2016). La titular es responsable de proveer las
> herramientas de descifrado si una autoridad legitimada lo requiere.

El ZIP de `DNDA_ESTRUCTURA_ZIP.md` está preparado para este Paso 2. Puede enviarse tal cual o cifrado con contraseña (`zip -e`).

| Paso | Cuándo | Qué se entrega | Formato |
|---|---|---|---|
| **1 — Portal** | Inmediatamente | Formulario + pagos + documentación | Archivos sueltos ≤ 20 MB, extensiones permitidas |
| **2 — Código** | Tras comunicación DNDA | Código fuente completo | Según instrucciones de la DNDA |

## 0.1 PAGOS OBLIGATORIOS (previos al inicio)

| Pago | Monto | Cuándo |
|---|---|---|
| Arancel del trámite | **$3.800** | Antes de iniciar el expediente |
| Tasa sobre el ejemplar | **0,2% del valor de la obra** (mínimo $4,11) | Antes de iniciar el expediente |

> Guardar ambos comprobantes en PDF/JPG listos para subir al portal.

## 1. RESTRICCIONES DEL PORTAL ONLINE — PASO 1

| Restricción | Valor |
|---|---|
| **Tamaño máximo** | 20 MB por archivo |
| **Extensiones permitidas** | pdf, doc, docx, xlsx, jpg, jpeg, png, bmp, gif, tiff, tif, html, dwf |

### Implicancias

1. **NO se acepta ZIP** en el Paso 1 — se suben archivos individuales.
2. **NO se aceptan archivos de código** (`.py`, `.ts`, `.tsx`, `.sql`) — el código fuente se convierte a **PDF** o **HTML**.
3. **NO se aceptan `.md` ni `.txt`** — toda la documentación de registro va como **PDF**.
4. **Límite de 20 MB por archivo** — si un PDF supera el tamaño, se parte en varios.

## 2. LISTA DE ARCHIVOS A SUBIR — PASO 1 (portal)

### Grupo 0 — Comprobantes de pago (OBLIGATORIOS)

| # | Archivo a subir | Descripción |
|---|---|---|
| 0a | `COMPROBANTE_PAGO_TRAMITE.pdf`/`.jpg` | Comprobante de pago del trámite ($3.800) |
| 0b | `COMPROBANTE_PAGO_TASA.pdf`/`.jpg` | Comprobante de pago de la tasa (0,2%, mín. $4,11) |

### Grupo 1 — Documentación jurídica y técnica (PDF)

| # | Archivo a subir | Origen |
|---|---|---|
| 1 | `MEMORIA_DESCRIPTIVA.pdf` | `REGISTRO_OBRA_SOFTWARE/MEMORIA_DESCRIPTIVA.md` |
| 2 | `EVIDENCIA_AUTORIA.pdf` | `EVIDENCIA_AUTORIA.md` |
| 3 | `INVENTARIO_TECNICO.pdf` | `INVENTARIO_TECNICO.md` |
| 4 | `DOCUMENTACION_TECNICA.pdf` | `DOCUMENTACION_TECNICA.md` |
| 5 | `MANUAL_FUNCIONAL.pdf` | `MANUAL_FUNCIONAL.md` |
| 6 | `ACTIVOS_PI.pdf` | `ACTIVOS_PI.md` |
| 7 | `RESUMEN_EJECUTIVO.pdf` | `RESUMEN_EJECUTIVO.md` |
| 8 | `MODULOS_DEL_SISTEMA.pdf` | `MODULOS_DEL_SISTEMA.md` |

### Grupo 2 — Código fuente (va en el PASO 2, no en el portal inicial)

> El código fuente **no se sube junto con la documentación del Paso 1**. Ver `DNDA_ESTRUCTURA_ZIP.md` para la estructura del paquete de código del Paso 2.

**Si la DNDA pide código en PDF (alternativa al ZIP):**

| # | Archivo | Contenido |
|---|---|---|
| 9 | `CODIGO_FUENTE_BACKEND.pdf` | Todo `backend/app` + migraciones |
| 10 | `CODIGO_FUENTE_FRONTEND.pdf` | Todo `frontend/app`, `frontend/components`, `frontend/lib` |

> Si alguno supera 20 MB, partirlo en varios PDFs numerados.

### Grupo 3 — Evidencia visual

| # | Archivo a subir | Contenido |
|---|---|---|
| 11 | `CAPTURAS.pdf` | Las capturas reales consolidadas en un único PDF (una por página, con epígrafe) |

### Grupo 4 — Comprobantes de pago + DNI (OBLIGATORIOS)

| # | Archivo a subir | Contenido |
|---|---|---|
| 12 | `COMPROBANTE_PAGO_TRAMITE.pdf`/`.jpg` | Pago del trámite |
| 13 | `COMPROBANTE_PAGO_TASA.pdf`/`.jpg` | Pago de tasa |
| 14 | `DNI_ARRAZATE.pdf`/`.jpg` | Copia/foto del DNI |

## 3. CÓMO GENERAR LOS PDF DE CÓDIGO FUENTE

### Opción A — `enscript` + `ps2pdf` (Linux/Mac)

```bash
cd /ruta/al/repositorio/staffing-gastro

# Backend (Python)
find backend/app -name "*.py" | sort > /tmp/lista_back.txt
enscript --line-numbers --header='$n|Oido|Pagina $% de $=' \
  -p /tmp/backend.ps $(cat /tmp/lista_back.txt)
ps2pdf /tmp/backend.ps CODIGO_FUENTE_BACKEND.pdf

# Frontend (TypeScript/TSX)
find frontend/app frontend/components frontend/lib -name "*.ts" -o -name "*.tsx" | sort > /tmp/lista_front.txt
enscript --line-numbers --header='$n|Oido|Pagina $% de $=' \
  -p /tmp/frontend.ps $(cat /tmp/lista_front.txt)
ps2pdf /tmp/frontend.ps CODIGO_FUENTE_FRONTEND.pdf
```

### Opción B — HTML (extensión permitida, sin instalar nada)

Generar un `.html` por componente con el código embebido y subirlo directamente.

### Opción C — VS Code

"Print to PDF" con números de línea activados.

## 4. CÓMO CONSOLIDAR LAS CAPTURAS EN UN PDF

```bash
cd CAPTURAS
convert $(ls -1 *.png | sort) CAPTURAS.pdf
# Si supera 20 MB:
convert $(ls -1 *.png | sort) -resize 1600x -quality 85 CAPTURAS.pdf
```

## 5. GESTIÓN DEL LÍMITE DE 20 MB

| Si un archivo supera 20 MB | Solución |
|---|---|
| PDF de código muy grande | Partir por capa o por módulo (backend_1, backend_2) |
| PDF de capturas pesado | Reducir resolución a 1600 px y calidad 85% |

## 6. ORDEN SUGERIDO DE CARGA EN EL PORTAL — PASO 1

1. `COMPROBANTE_PAGO_TRAMITE.pdf`
2. `COMPROBANTE_PAGO_TASA.pdf`
3. `DNI_ARRAZATE.pdf`
4. `MEMORIA_DESCRIPTIVA.pdf`
5. `EVIDENCIA_AUTORIA.pdf`
6. `INVENTARIO_TECNICO.pdf`
7. `DOCUMENTACION_TECNICA.pdf`
8. `MANUAL_FUNCIONAL.pdf`
9. `MODULOS_DEL_SISTEMA.pdf`
10. `ACTIVOS_PI.pdf`
11. `RESUMEN_EJECUTIVO.pdf`
12. `CAPTURAS.pdf`

> El código (Paso 2) se carga **después** de recibir la comunicación de la DNDA.

## 7. RELACIÓN CON `DNDA_ESTRUCTURA_ZIP.md` — PASO 2

Resumen del flujo completo:

```
HOY                             LUEGO (tras email DNDA)
─────────────────────────────   ──────────────────────────────────
Portal online                   Canal indicado por DNDA
  └── Formulario (datos obra)     └── ZIP con código fuente completo
  └── Comprobante pago $3800           (puede ir cifrado si se prefiere)
  └── Comprobante pago tasa
  └── DNI
  └── 8 PDFs documentación
  └── CAPTURAS.pdf
         ↓
  Expediente electrónico generado
         ↓
  Email de DNDA con instrucciones
```

**Silencio positivo:** transcurridos 60 días hábiles desde que se acreditó el cumplimiento de todas las condiciones, sin respuesta de la DNDA, el registro se considera otorgado (Art. 10 inciso b, Ley 19.549).

## 8. CHECKLIST DE FORMATO

### Paso 1 — Portal (hacer primero)
- [ ] Pagar arancel ($3.800) y guardar comprobante
- [ ] Pagar tasa (0,2% del valor declarado) y guardar comprobante
- [ ] DNI en PDF/JPG listo
- [ ] Los 8 PDFs de documentación generados en español
- [ ] `CAPTURAS.pdf` consolidado (< 20 MB) — o capturas sueltas
- [ ] Cada archivo < 20 MB
- [ ] Ningún archivo `.zip`, `.py`, `.ts`, `.md`, `.txt` en el Paso 1

### Paso 2 — Código (esperar email de DNDA)
- [ ] ZIP preparado según `DNDA_ESTRUCTURA_ZIP.md`
- [ ] ZIP verificado sin archivos sensibles
- [ ] (Opcional) ZIP cifrado con contraseña

---

*Documento de formato de presentación para portal DNDA — Julieta Arrazate — Septiembre 2026*
