# AUDITORÍA DE PRIVACIDAD Y DATOS PERSONALES
## Verificación de información sensible en el código fuente — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. TIPOS DE DATOS EN EL SISTEMA

| Tipo de dato | Sensibilidad | Ubicación | Estado en el código |
|---|---|---|---|
| Email de usuario | Alta | Tabla `User` | Necesario para autenticación, permitido por Ley 25.326 |
| Nombre de trabajador/comercio | Media | `WorkerProfile`/`CompanyProfile` | Dato funcional necesario del marketplace |
| Contraseña (hasheada) | Crítica | `User` | Hasheada, nunca en texto plano |
| DNI / selfie (verificación de identidad) | Crítica | Cloudinary (externo) + referencia en `VerificationClaim` | Sólo se almacena la referencia/URL firmada; el resultado visible a terceros es un nivel de garantía agregado, nunca la imagen |
| Geolocalización (check-in/check-out, ubicación de perfil) | Alta | `Shift`, `WorkerProfile`, `CompanyProfile` | Necesaria para el matching y la asistencia geolocalizada |
| Refresh token | Crítica | Cookie `httpOnly` + tabla de sesiones revocables | Nunca en `localStorage` ni en el cuerpo de la respuesta |

**Conclusión:** los datos procesados son los necesarios para el funcionamiento del marketplace. No se detectó recolección de datos superflua.

## 2. AUDITORÍA DEL CÓDIGO FUENTE — DATOS HARDCODEADOS

### 2.1 Búsqueda de emails reales

**Resultado:** los únicos emails que aparecen en el código fuente corresponden a cuentas de demostración (`invitado.trabajador@oido.beta`, `invitado.comercio@oido.beta`) y a ejemplos genéricos en tests. No se encontraron emails de terceros reales ni de comercios/trabajadores de la beta.

### 2.2 Búsqueda de nombres de comercios o trabajadores reales

**Resultado:** los nombres de comercio que aparecen en los datos de demostración combinan categoría gastronómica genérica + barrio de Buenos Aires (por ejemplo "Bar Palermo Soho", "Café Núñez", "Pizzería Almagro"), sin corresponder a ningún comercio real existente. Los nombres de trabajador en fixtures de test son igualmente genéricos o inventados. No se detectaron datos de comercios o trabajadores reales de la beta en el código fuente.

### 2.3 Búsqueda de tokens o claves en el código

**Resultado:** no se encontraron tokens, claves de API, contraseñas ni secretos hardcodeados en el código fuente. Todos se leen de variables de entorno, configuradas exclusivamente en los paneles de Render y Vercel.

### 2.4 Búsqueda de rutas de usuario local o información de infraestructura interna

**Resultado:** no se encontraron rutas de sistema de archivos local de la autora ni identificadores internos de infraestructura (IDs de servicio, connection strings) en el código fuente versionado. Las URLs públicas de producción (frontend en Vercel, backend en Render) son información pública, ya visible para cualquier usuario del sistema.

## 3. VERIFICACIÓN DE CUMPLIMIENTO CON LEY 25.326 (ARGENTINA)

| Requisito | Cumplimiento | Evidencia |
|---|---|---|
| Consentimiento | ✓ | Checkbox de consentimiento obligatorio en el registro |
| Finalidad declarada | ✓ | `/terminos` y `/privacidad` públicas en la aplicación |
| Datos no superfluos | ✓ | Sólo se solicitan los datos necesarios para operar el marketplace |
| Seguridad | ✓ | Contraseñas hasheadas, JWT de corta duración, refresh token rotativo en cookie `httpOnly`, rate limiting |
| Acceso y rectificación de los titulares | ✓ | El usuario edita sus propios datos de perfil |
| Auditoría | ✓ | Registro de eventos relevantes del ciclo del turno como notificaciones trazables |

**Conclusión:** ✓ Cumple con la Ley 25.326.

## 4. INFORMACIÓN CONFIDENCIAL EN LA DOCUMENTACIÓN

### 4.1 Datos públicos, seguros de incluir

- Arquitectura del sistema (monolito modular DDD/hexagonal, FastAPI + Next.js, PostgreSQL).
- Tecnologías y versiones utilizadas.
- URL pública de producción del frontend (https://staffing-gastro.vercel.app).

### 4.2 Datos que se excluyen del expediente por prudencia operativa

- Nombre del proyecto de base de datos en Neon y su región exacta de infraestructura.
- Configuración de despliegue (`render.yaml`) y valores de dimensionamiento de pool de conexiones.
- Bitácora operativa interna (`docs/STATUS.md`, `docs/TECH_DEBT.md`), que documenta incidentes y decisiones de proceso, no la obra en sí.

Ver el detalle completo de exclusiones en `DNDA_EXCLUSIONES.md`.

## 5. DATOS DINÁMICOS EN PRODUCCIÓN (BASE DE DATOS)

El código fuente presentado es **solo el código**, no incluye la base de datos con datos personales de los usuarios reales de la beta. La base de datos:

- Reside en Neon (servidor externo), no en el repositorio.
- No se incluye en el ZIP de registro.
- Está protegida por credenciales configuradas exclusivamente en Render, nunca compartidas ni versionadas.

## 6. BÚSQUEDA DE PATRONES SENSIBLES — RESULTADO FINAL

| Patrón buscado | Resultado |
|---|---|
| `password =` / `secret =` / `token =` hardcodeado | No encontrado (sólo lectura de variables de entorno) |
| Claves de API en texto plano | No encontrado |
| Datos de tarjetas de pago | No encontrado (la integración de pagos delega en Mercado Pago, sin almacenar datos de tarjeta) |
| Números de documento reales | No encontrado en código; las verificaciones de identidad reales de la beta viven fuera del repositorio (Cloudinary + base de datos de producción) |
| Rutas de usuario local | No encontrado |

## 7. CHECKLIST FINAL DE PRIVACIDAD

- [x] No hay emails de comercios o trabajadores reales en el código
- [x] No hay nombres de comercios reales en datos de demostración
- [x] No hay tokens o claves hardcodeadas
- [x] No hay rutas de usuario local
- [x] Contraseñas hasheadas, nunca en texto plano
- [x] Refresh token sólo en cookie `httpOnly`, nunca en `localStorage`
- [x] Datos de tests y seed son ficticios o genéricos
- [x] Archivos `.env` reales nunca versionados
- [x] Cumple la Ley 25.326 (Argentina)
- [x] `REGISTRO_OBRA_SOFTWARE/` es seguro para presentar

## 8. RESUMEN DE AUDITORÍA

| Categoría | Estado |
|---|---|
| Emails reales | ✓ Seguro — sólo demo/ficticios |
| Nombres sensibles | ✓ Seguro — genéricos por diseño |
| Contraseñas | ✓ Seguro — hasheadas |
| Tokens/claves | ✓ Seguro — nunca hardcodeadas |
| Datos de identidad (DNI/selfie) | ✓ Seguro — referencia firmada, resultado agregado |
| Cumplimiento legal | ✓ Completo (Ley 25.326) |

**Conclusión final:** el código fuente es seguro para presentar ante la DNDA, sin riesgo de exposición de datos privados de terceros.

---

*Documento de auditoría de privacidad para expediente DNDA — Julieta Arrazate — Septiembre 2026*
