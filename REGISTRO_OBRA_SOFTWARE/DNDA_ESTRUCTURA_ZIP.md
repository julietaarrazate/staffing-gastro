# ESTRUCTURA FINAL DEL PAQUETE ZIP
## Organización exacta de archivos para presentación ante DNDA — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

> **⚠️ ÁMBITO DE ESTE DOCUMENTO — CANAL B (depósito de código fuente)**
>
> Este ZIP corresponde al **depósito del código fuente completo**, que la DNDA
> recibe por el canal de carga digital que comunica por email tras iniciar el
> expediente (ver `DNDA_FORMATO_PRESENTACION.md`, Paso 2). **NO es para el
> portal de carga online del Paso 1**, que tiene un límite de 20 MB por
> archivo y no acepta ZIP ni archivos de código fuente.
>
> **Antes de usar este ZIP, confirmar con la DNDA el medio exacto del Canal B**
> según la comunicación recibida.

---

## 1. ESTRUCTURA RECOMENDADA

```
EXPEDIENTE_DNDA_OIDO_2026_09.zip
│
├── SOFTWARE/
│   ├── backend/                           # Código FastAPI + Python 3.11
│   │   ├── app/
│   │   │   ├── core/
│   │   │   ├── modules/                   # 17 módulos (domain/application/infrastructure/api)
│   │   │   └── main.py
│   │   ├── alembic/
│   │   │   ├── versions/                  # 30 migraciones
│   │   │   ├── env.py
│   │   │   └── script.py.mako
│   │   ├── tests/                         # 429 tests automatizados
│   │   ├── scripts/                       # seed de datos demo
│   │   ├── requirements.txt
│   │   ├── pyproject.toml
│   │   ├── .env.example                   # Template env (sin valores)
│   │   └── README.md
│   │
│   ├── frontend/                          # Código Next.js + TypeScript (PWA)
│   │   ├── app/                           # 31 páginas
│   │   ├── components/                    # 87 componentes
│   │   ├── lib/                           # 45 módulos de utilidades/cliente
│   │   ├── e2e/                           # 31 specs Playwright
│   │   ├── public/
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── tsconfig.json
│   │   ├── .env.production                # sólo variable pública
│   │   ├── README.md
│   │   └── (NO node_modules/, NO .next/)
│   │
│   ├── docs/
│   │   ├── foundation/                    # PRODUCT.md, DOMAIN.md, ARCHITECTURE.md, PRINCIPLES.md
│   │   └── adr/                           # 11 Architecture Decision Records
│   │
│   ├── REGISTRO_OBRA_SOFTWARE/            # Documentación de registro (30-31 .md)
│   │
│   ├── README.md
│   ├── LICENSE
│   ├── NOTICE
│   └── .gitignore                         # Archivo de control Git (informativo)
│
├── DOCUMENTACION/
│   ├── MEMORIA_DESCRIPTIVA.pdf
│   ├── INVENTARIO_TECNICO.pdf
│   ├── DOCUMENTACION_TECNICA.pdf
│   ├── MANUAL_FUNCIONAL.pdf
│   ├── MODULOS_DEL_SISTEMA.pdf
│   ├── EVIDENCIA_AUTORIA.pdf
│   ├── ACTIVOS_PI.pdf
│   ├── RESUMEN_EJECUTIVO.pdf
│   └── CODIGO_FUENTE_EXTRACTO.pdf         # (opcional: extracto representativo)
│
├── CAPTURAS/                              # Capturas reales del sistema (ver DNDA_CAPTURAS.md)
│
├── DIAGRAMAS/
│   ├── arquitectura_sistema.png
│   ├── base_de_datos_er.png
│   ├── ciclo_de_vida_turno.png
│   └── flujo_matching.png
│
└── INDICE_CONTENIDO.txt
```

---

## 2. TAMAÑO POR SECCIÓN

| Sección | Componentes | Tamaño estimado |
|---|---|---|
| SOFTWARE/backend | Código + tests + migraciones | ~1–2 MB |
| SOFTWARE/frontend | Código + PWA | ~2–3 MB |
| SOFTWARE/docs | foundation/ + adr/ | ~200 KB |
| SOFTWARE/REGISTRO_OBRA_SOFTWARE | 30-31 .md | ~600–700 KB |
| SOFTWARE/ (raíz) | README, LICENSE, NOTICE | ~30 KB |
| DOCUMENTACION | 8-9 PDFs en español | ~10-12 MB |
| CAPTURAS | 27 capturas PNG | ~12-16 MB |
| DIAGRAMAS | 4 imágenes PNG | ~500 KB |
| **TOTAL PAQUETE** | — | **~27-35 MB** |

**Cumple requisito DNDA:** < 2 GB ✓

---

## 3. ARCHIVO ÍNDICE

**Crear archivo `INDICE_CONTENIDO.txt` en raíz del ZIP:**

```
EXPEDIENTE DE REGISTRO DE OBRA DE SOFTWARE
DNDA 2026 — Julieta Arrazate

Oído — Marketplace de Staffing Gastronómico en Tiempo Real

═══════════════════════════════════════════════════════

CONTENIDO DEL PAQUETE:

1. SOFTWARE/
   - Código fuente íntegro (backend, frontend)
   - Base de datos: 30 migraciones Alembic
   - Tests: 429 (backend) + 75 (E2E)
   - Documentación técnica: docs/foundation + docs/adr
   - Documentación de registro: REGISTRO_OBRA_SOFTWARE (30-31 .md)

2. DOCUMENTACION/
   - 8-9 PDFs en español (memoria, inventario, etc.)

3. CAPTURAS/
   - Capturas de pantalla del sistema funcionando

4. DIAGRAMAS/
   - 4 diagramas de arquitectura

═══════════════════════════════════════════════════════

AUTORA: Julieta Arrazate <julietaarrazate@gmail.com>
FECHA: Septiembre 2026
```

---

## 4. CHECKLIST DE EMPAQUETAMIENTO

- [ ] SOFTWARE/backend/ contiene código completo (sin `.venv`, `.venv-check`, `__pycache__`)
- [ ] SOFTWARE/frontend/ contiene código completo (sin `node_modules`, `.next`)
- [ ] SOFTWARE/docs/ contiene sólo `foundation/` y `adr/`
- [ ] SOFTWARE/REGISTRO_OBRA_SOFTWARE/ contiene todos los .md del expediente
- [ ] SOFTWARE/ contiene README.md, LICENSE, NOTICE
- [ ] DOCUMENTACION/ contiene 8-9 PDFs en español
- [ ] CAPTURAS/ contiene las capturas reales tomadas por la autora
- [ ] DIAGRAMAS/ contiene los 4 diagramas de arquitectura
- [ ] INDICE_CONTENIDO.txt existe en raíz
- [ ] Ningún archivo `.env` real con credenciales
- [ ] Ningún archivo `.pem`, `.key`
- [ ] Todos los PDFs están en español, con acentos correctos

---

*Documento de estructura ZIP para expediente DNDA — Julieta Arrazate — Septiembre 2026*
