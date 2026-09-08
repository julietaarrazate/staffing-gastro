# MATERIAL COMPLEMENTARIO PARA EL REGISTRO
## Guía de diagramas y evidencia visual — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. CAPTURAS DE PANTALLA

Ver el inventario completo de capturas recomendadas, con nomenclatura y prioridad, en `DNDA_CAPTURAS.md`. Ninguna captura fue tomada para este expediente: la autora las tomará desde su cuenta real de producción antes de armar el ZIP final.

## 2. DIAGRAMAS TÉCNICOS RECOMENDADOS

### 2.1 Diagrama de arquitectura

**Archivo:** `DIAGRAMAS/arquitectura_sistema.png`

**Contenido mínimo:**
```
Frontend Web (Next.js, PWA)
        ↓ HTTPS + WebSocket
API + WebSocket (FastAPI, monolito modular DDD/hexagonal — 17 módulos)
        ↓ SQL asíncrono
PostgreSQL (Neon, serverless)
        ↓ opcionales
[Gemini IA] [Cloudinary] [Resend] [Sentry] [Mercado Pago] [Google Identity Services]
```

**Herramienta sugerida:** Excalidraw, draw.io (app.diagrams.net), Figma.

### 2.2 Diagrama de base de datos (entidad-relación simplificado)

**Archivo:** `DIAGRAMAS/base_de_datos_er.png`

**Entidades principales a incluir:**
```
User ← WorkerProfile / CompanyProfile
Shift ← CompanyProfile ; Shift → ShiftApplication ← WorkerProfile
Shift → Notification, ChatMessage, Review
CompanyProfile → Subscription
User → VerificationClaim
WorkerProfile/CompanyProfile → Favorite
WorkerProfile → SavedShift
CompanyProfile → AssistantQueryLog
```

**Herramienta sugerida:** dbdiagram.io, draw.io, o un generador de ER a partir del schema real de PostgreSQL.

### 2.3 Diagrama del ciclo de vida del turno

**Archivo:** `DIAGRAMAS/ciclo_de_vida_turno.png`

**Contenido:**
```
borrador → publicado → buscando_personal → asignado → confirmado
   → en_camino → check_in → trabajando → check_out → finalizado → pagado

(en cualquier punto anterior al cierre: cancelado)
```

### 2.4 Diagrama de flujo del motor de matching

**Archivo:** `DIAGRAMAS/flujo_matching.png`

**Contenido:**
```
Turno publicado
  ↓
Filtrar trabajadores elegibles (disponibilidad + habilidad requerida)
  ↓
Para cada candidato elegible:
  Calcular distancia (Haversine) → score de distancia
  Calcular score de experiencia, reputación, puntualidad, desempeño
  ↓
Combinar en un score ponderado único
  ↓
Ordenar candidatos de mayor a menor score
  ↓
El comercio ve el ranking y asigna
```

## 3. ESTRUCTURA RECOMENDADA DEL ZIP FINAL

Ver la estructura completa y el detalle por carpeta en `DNDA_ESTRUCTURA_ZIP.md` y `PAQUETE_FINAL.md`.

## 4. CHECKLIST DE MATERIAL COMPLEMENTARIO

- [ ] Capturas de pantalla tomadas según `DNDA_CAPTURAS.md`
- [ ] `arquitectura_sistema.png`
- [ ] `base_de_datos_er.png`
- [ ] `ciclo_de_vida_turno.png`
- [ ] `flujo_matching.png`

---

*Documento elaborado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
