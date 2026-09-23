# MANUAL FUNCIONAL
## Oído — Casos de uso y operación del sistema

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. FLUJO OPERATIVO GENERAL

1. El trabajador o el comercio se registran (email+contraseña o cuenta de Google) y completan el onboarding de su perfil (`/bienvenida`).
2. El comercio publica un turno (manualmente o describiéndolo en lenguaje natural al asistente de IA).
3. El turno aparece en el feed de trabajadores elegibles (habilidad + disponibilidad) y en el mapa.
4. El trabajador se postula (estilo swipe) o el comercio elige directamente un candidato recomendado por el motor de matching.
5. El comercio asigna el turno; el trabajador confirma o rechaza la asignación.
6. El día del turno: el trabajador marca "en camino", hace check-in geolocalizado al llegar, trabaja, hace check-out geolocalizado al terminar.
7. El comercio cierra el turno (`finalizado`) y lo marca como pagado.
8. Ambas partes dejan una reseña bidireccional, que recalcula la reputación de cada una y realimenta el matching futuro.

A lo largo de todo el flujo, comercio y trabajador pueden chatear en tiempo real sobre el turno, y reciben notificaciones in-app y push de cada evento relevante.

---

## 2. CASOS DE USO — ROL TRABAJADOR

| # | Caso de uso | Descripción |
|---|---|---|
| CU-01 | Registrarse | Alta con email+contraseña o cuenta de Google; acepta términos y política de privacidad |
| CU-02 | Completar el perfil | Foto, ciudad, biografía, habilidades, años de experiencia, idiomas, certificaciones, CV |
| CU-03 | Ver el feed de turnos | Turnos abiertos filtrados por habilidad propia y cercanía |
| CU-04 | Postularse a un turno | Swipe/postulación; único por turno |
| CU-05 | Guardar un turno | Marcarlo para verlo después sin postularse |
| CU-06 | Confirmar o rechazar una asignación | El comercio lo eligió; decide si acepta |
| CU-07 | Compartir un turno con un colega | Link para compartir por mensajería desde la tarjeta del feed |
| CU-08 | Marcar "en camino" | Inicia el tramo de asistencia geolocalizada |
| CU-09 | Hacer check-in | Con geolocalización, al llegar al lugar del turno |
| CU-10 | Hacer check-out | Con geolocalización, al terminar el turno |
| CU-11 | Chatear con el comercio | Mensajería en tiempo real por turno |
| CU-12 | Dejar una reseña al comercio | Al cerrar el turno |
| CU-13 | Ver su reputación | Rating, insignias, nivel de gamificación, historial |
| CU-14 | Verificar su identidad | Subir DNI y selfie para obtener "Identidad verificada" |
| CU-15 | Marcar favoritos | Comercios de interés para acceso rápido |
| CU-16 | Buscar en lenguaje natural | Asistente de IA para trabajadores (búsqueda conversacional de turnos) |
| CU-17 | Recibir notificaciones | Push y en tiempo real de cada evento relevante de sus turnos |
| CU-18 | Contactar soporte | Canal de contacto ante un problema |
| CU-18b | Activar "Disponible ahora" | Comparte su posición real por 4 horas para que los comercios midan la distancia desde ahí; el pin que ven siempre va desplazado (ADR-0014) |
| CU-18c | Avisar "Voy en camino" | Durante las 2 horas previas a un turno confirmado, comparte su última posición para que el comercio lo vea llegar; se borra al marcar la llegada |

## 3. CASOS DE USO — ROL COMERCIO

| # | Caso de uso | Descripción |
|---|---|---|
| CU-19 | Registrarse | Alta con email+contraseña o cuenta de Google |
| CU-20 | Dar de alta el local desde el mapa | Nombre, categoría, dirección con geocoder + pin arrastrable |
| CU-21 | Completar el perfil del comercio | Logo, foto del local, descripción, capacidad, horarios |
| CU-21b | Verificar el comercio | Subir la constancia de inscripción de AFIP; un administrador la revisa y se enciende el sello "Comercio verificado" (ADR-0013) |
| CU-22 | Publicar un turno | Formulario manual, con puesto/horario/pago/propinas/vestimenta/urgencia; avisa si el pago está por debajo de lo habitual para el puesto y la ciudad (ADR-0012) |
| CU-23 | Publicar un turno con IA | Describir el turno en lenguaje natural; el asistente prellena el formulario para revisión |
| CU-24 | Ver postulantes de un turno | Lista de trabajadores que se postularon |
| CU-25 | Ver candidatos recomendados | Ranking del motor de matching por turno, con desglose del score |
| CU-26 | Asignar un turno | Elegir postulante o candidato recomendado |
| CU-27 | Marcar "no se presentó" | Reabre el turno y penaliza al trabajador (no-show) |
| CU-28 | Cancelar un turno con trabajador confirmado | Penaliza al comercio (cancelación tardía) |
| CU-29 | Duplicar un turno | Reutilizar la configuración de un turno anterior |
| CU-30 | Compartir un turno | Link para compartir por mensajería, página pública sin autenticación |
| CU-31 | Chatear con un trabajador asignado | Mensajería en tiempo real por turno |
| CU-32 | Marcar un turno como pagado | Cierre administrativo del ciclo (sin procesar el cobro real) |
| CU-33 | Dejar una reseña al trabajador | Al cerrar el turno |
| CU-34 | Ver el panel por familias de estado | Todos / Buscando / En marcha / Terminados / Cancelados |
| CU-35 | Consultar al asistente sobre sus turnos | "¿Cuántos turnos tengo hoy?", "¿qué turnos urgentes tengo sin cubrir?" |
| CU-36 | Gestionar su suscripción | Ver plan actual, uso frente al tope mensual, cambiar de plan |
| CU-37 | Marcar favoritos | Trabajadores de interés para acceso rápido |

## 4. CASOS DE USO — ROL ADMINISTRADOR

| # | Caso de uso | Descripción |
|---|---|---|
| CU-38 | Revisar la cola de verificación | Aprobar o rechazar DNI/selfie de trabajadores y constancias de AFIP de comercios |
| CU-39 | Moderar usuarios | Habilitar/deshabilitar cuentas |
| CU-40 | Ver métricas del sistema | Uso general, suscripciones/MRR, exclusión de cuentas demo |
| CU-41 | Gestionar cuentas de prueba | Crear/ver cuentas de demostración de trabajador y comercio |

---

## 5. GESTIÓN DE ESTADOS DEL TURNO

El estado de un `Shift` transita, en el caso feliz, por:

```
borrador → publicado → buscando_personal → asignado → confirmado
   → en_camino → check_in → trabajando → check_out → finalizado → pagado
```

Con `cancelado` como estado terminal alternativo en cualquier punto anterior al cierre. Reglas relevantes:

- `start_at < end_at` es un invariante de publicación.
- Sólo el comercio dueño puede editar/cancelar el turno.
- El feed sólo muestra turnos en estados abiertos (`publicado`/`buscando_personal`).
- El rechazo de un asignado devuelve el turno a `buscando_personal` y reactiva a los postulantes previamente rechazados.
- `cancelado`, `finalizado` y `pagado` son terminales.
- `no_cubierto` (ADR-0015) es terminal: un turno asignado que nadie confirmó, o publicado que nadie tomó, cuyo horario ya pasó, se resuelve solo sin impacto de reputación. La ventana de gracia es de 30 minutos si el turno era urgente y de 2 horas si no.

## 6. GESTIÓN DOCUMENTAL

**Formatos de entrada:** CV del trabajador (PDF, Word o foto, o link externo), foto de perfil/logo (imagen), DNI y selfie para verificación (imagen).

**Formatos de salida:** ninguna exportación masiva de datos hoy (a diferencia de un ERP contable); la información se consulta en pantalla y por el asistente de IA en lenguaje natural.

---

*Documento generado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
