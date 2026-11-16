# Etapa 3 — triaje de los 60 menores

> Hecho el 2026-11-16 sobre `main` 893a063, leyendo el código (sin correr la app
> salvo donde se dice). El detalle de cada hallazgo (pasos, capturas) sigue en el
> tablero privado de la etapa 1; acá van el estado, el tipo, el grupo de PR y la
> evidencia en el código. Se edita en el lugar: al cerrar un grupo, su fila pasa
> a ✅ en [`BETA_TABLERO.md`](./BETA_TABLERO.md).


| uid | título corto | estado | tipo | tam | grupo | evidencia |
|---|---|---|---|---|---|---|
| U012 | Reintentar duplica mensaje de chat o ticket de soporte | vigente | arreglo | M | F | chat/api/routes.py y support/api/routes.py sin RecorderDep/idempotent (sí lo tienen application, review, shift, subscription) |
| U017 | La campanita suma mensajes ya leídos con el chat abierto | vigente | arreglo | M | F | chat/application/services.py crea siempre el aviso; chats/layout.tsx:90 sólo baja el contador del chat |
| U018 | Al finalizar el turno, el trabajador no recibe aviso | vigente | decide-Julieta | S | - | shift/application/services.py finish no llama a _notify_worker; falta tipo de aviso (DOMAIN.md) |
| U022 | Candidatos de un turno cancelado sigue ofreciendo «Asignar» | vigente | arreglo | S | G | candidates/page.tsx no mira el estado del turno (grep status/cancelado vacío) |
| U027 | Candidatos y perfil del trabajador sin «volver» | vigente | arreglo | S | G | workers/[id]/page.tsx:132 «Volver» sólo en el error; candidates sin control |
| U037 | Dirección con altura primero y ciudad «Buenos Aires» | vigente | arreglo | S | B | geocoder.ts shortAddress sigue tomando los 3 primeros segmentos de display_name |
| U039 | Google sobre cuenta con clave y mail sin confirmar la «reclama» sin aviso | vigente | decide-Julieta | M | - | identity/application/services.py:_claim_unverified_account es decisión de seguridad deliberada |
| U040 | Carteles del mapa en inglés | vigente | arreglo | S | B | MapAddressPicker.tsx:276 cooperativeGestures sin locale |
| U041 | Registro acepta nombre de espacios y clave de letras iguales; botón sin explicar | vigente | arreglo | M | C | identity/api/schemas.py RegisterRequest sin validador de nombre/clave; register/page.tsx:176 disabled mudo |
| U042 | Registro no avisa del mail; «Ingresar» en /verificar-email lleva al login con sesión | vigente | arreglo | S | C | verificar-email/page.tsx:59 Link fijo a /login |
| U043 | Alta con Google: pregunta rol de nuevo, dos casillas de términos, «Busco trabajo» descarta plan | vigente | arreglo | M | C | GoogleAuthButton.tsx:135-226 (casilla + rol propios) y register/page.tsx:166-176 |
| U044 | No deja hacer zoom con pellizco | vigente | arreglo | S | K | layout.tsx:116-117 maximumScale:1, userScalable:false |
| U046 | Comanda: «viernes… hasta las 2 de la mañana» se lee «Mañana» | vigente | arreglo | S | K | pedido-natural.ts:32-55 busca «mañana» en todo el texto sin contexto |
| U047 | Mi plan: anillo ámbar + anillo azul + botón ámbar | vigente | arreglo | S | K | PlanCard.tsx:42 ring-primary en plan actual; sin verificar render |
| U048 | Doble anillo de foco en buscador de dirección | vigente | arreglo | S | B | MapAddressPicker.tsx:190 ring + globals.css:814 outline; sin verificar render |
| U049 | Selectores de provincia/barrio vacíos; «Mi ubicación actual» como zona | vigente | arreglo | M | B | LocationPicker.tsx:41-43 estado inicial en 0/"" y :74-76 fallback de texto |
| U050 | Horas 12 h y 24 h mezcladas, «ARS» y «$», distancias con , y . | vigente | arreglo | M | E | datetime.ts:47-52 sin hour12 vs :36 hour12:false; admin/en-vivo/page.tsx:64 |
| U051 | Archivo no-imagen como foto abre el encuadre con imagen rota | vigente | arreglo | S | I | ImageCropModal.tsx:170-175 <img> sin onError ni chequeo de tipo |
| U052 | CV: error genérico y sin «Reemplazar»; años de experiencia no se vacía («07») | vigente | arreglo | S | I | CvUpload.tsx:60; WorkerProfileForm.tsx:225 Number(v)||0 |
| U059 | «Cancelar turno» en «No cubierto» | resuelto | arreglo | - | - | ShiftActions.tsx:27 CANCELLABLE_EXCLUDED incluye no_cubierto |
| U061 | IA de publicar: «Me falta saber…» queda en el paso 0, no se ve | vigente | arreglo | S | K | shifts/new/page.tsx:729 sigue en el paso 0 (el wizard salta de paso) |
| U066 | «Asignados» ordena por creación y mezcla pagados; recordatorios sin link | vigente | arreglo | M | H | shift/infrastructure/repositories.py list_by_worker; services.py:~890 CHECKIN_REMINDER sin link |
| U067 | Textos y formatos que no coinciden (Va/Voy en camino, Matches/Mis turnos, «1 turnos», mozo en minúscula) | vigente | arreglo | M | E | Navbar.tsx:112 «Mis turnos» vs BottomNav.tsx:20 «Matches»; plurales fijos en varias pantallas |
| U068 | Detalles visuales: pestaña Guardados cortada, nombres cortados, dos botones ámbar | vigente | arreglo | M | H | my-shifts/page.tsx:363,599; OpportunityCard.tsx; sin verificar render |
| U074 | Buscar: pierde filtros al volver, píldora blanca en oscuro, radio sin «km» | vigente | arreglo | M | G | search/page.tsx:152 bg-white/95 fijo; filtros en estado local |
| U084 | No se puede cancelar un evento entero | vigente | decide-Julieta | L | - | shifts/page.tsx sin acción de evento; hay que definir penalidad y avisos |
| U087 | Chat de turno cancelado/ausencia sigue abierto | resuelto | arreglo | - | - | chat/application/services.py:_authorize exige worker_profile_id y cancelar/no-show lo pone en None (entities.py:296,346,373) (#532) |
| U088 | Postulante de turno «No cubierto» lo ve «Postulado · esperando respuesta» | vigente | arreglo | S | H | my-shifts/page.tsx:49-52 APPLICATION_LABELS; sin caso no_cubierto |
| U091 | Archivo no permitido o pesado: mismo error genérico; «Rechazada» con poco contraste | vigente | arreglo | M | I | cloudinary.ts:185-188 error único; BusinessVerificationCard.tsx handleFile |
| U092 | «Cerrar ticket» cierra sin confirmar ni deshacer | vigente | arreglo | S | F | support/[id]/page.tsx:80-90,205 closeTicket directo |
| U098 | URL de pantalla del otro rol muestra vacío con «Permisos insuficientes» | vigente | arreglo | M | N | use-require-auth.ts sólo redirige sin token; ninguna guarda por rol |
| U099 | Chat de turno ajeno dice «no encontrada» pero deja escribir | vigente | arreglo | S | F | chats/[shiftId]/page.tsx:195 banner de error, form de envío (:258) siempre visible |
| U100 | Perfil público del trabajador deja ver el nombre del archivo del CV | vigente | arreglo | S | L | worker/api/routes.py:196-199 oculta cv_url pero no cv_filename |
| U101 | No hay verificación de edad (fecha de nacimiento / mayores de 18) | vigente | decide-Julieta | M | - | worker/api/schemas.py:21 birth_date opcional sin validar; texto legal en /privacidad:90 y /terminos:86 |
| U102 | Datos del invitado los ve el invitado siguiente | vigente | cerrado por decisión 5 | - | - | Decisión 5 (2026-11-13): el ingreso de invitado se apaga en la beta |
| U103 | Acción pegada a «Confirmar» da «El turno cambió mientras tanto» | vigente | arreglo | M | L | send_departure_reminder sube la versión del turno (ADR-0016); sin cambios en shift services |
| U106 | Asistente del trabajador no responde por su verificación | vigente | decide-Julieta | M | - | assistant/api/routes.py:158-170 sólo buscar_turnos; el doc lo promete |
| U107 | Mapa sin ubicación mide desde el Obelisco, Inicio desde la zona del perfil | vigente | arreglo | S | B | map/page.tsx:30 DEFAULT_CENTER; #585 (U073) sólo cubrió Buscar trabajadores |
| U109 | Verificación de identidad sin dorso del DNI | vigente | decide-Julieta | M | - | IdentityVerificationCard.tsx sólo frente y selfie; backend acepta dni_dorso |
| U110 | Soporte sin forma de reportar un turno o comercio | vigente | arreglo | L | F | TicketCategory sin turno/comercio y ticket sin shift_id (types.ts:662-668); requiere migración |
| U111 | Calificación no editable ni borrable; la pantalla no avisa | vigente | decide-Julieta | M | - | review/api/routes.py sólo POST; ReviewBox.tsx sin aviso de definitiva |
| U113 | Errores sin conexión genéricos; los del servidor en inglés («Bad Gateway») | vigente | arreglo | M | D | errors.ts:13 devuelve fallback para no-ApiError; api.ts:413 usa res.statusText |
| U116 | Pago 0 o negativo deja «Continuar» gris sin decir por qué | resuelto | arreglo | - | - | shifts/new/page.tsx:494-495 motivoBloqueo «Escribí cuánto pagás» (G14 #575) |
| U117 | Nombre de comercio largo ensancha la tarjeta de Matches | resuelto | arreglo | - | - | ShiftCard.tsx:207-213 min-w-0 + truncate (G19/G24, #568/#566); sin re-verificar render |
| U118 | Nombre y título larguísimos: postularse da error aunque se guardó, sin aviso | vigente | arreglo | S | L | application/services.py:~110 arma título/mensaje sin recortar; notifications.message String(500) |
| U119 | Guardar datos del comercio borra rubro/descr./capacidad/horarios | vigente | arreglo | M | A | CompanyProfileForm.tsx:86-94 no manda category/description/capacity/opening_hours; company services.py _apply los pisa con None |
| U121 | Evento con fin <= inicio da error del servidor | resuelto | arreglo | - | - | shift/api/routes.py:405 captura InvalidShiftScheduleError en create_event (G14 #575) |
| U122 | «Reenviar enlace» dice enviado pero no manda si hubo uno <5 min | vigente | arreglo | S | C | identity/application/services.py:576-581 return silencioso; (mantener anti-enumeración, ajustar texto) |
| U129 | «Turnos en vivo» corta en 200 y oculta los nuevos sin avisar | vigente | arreglo | M | M | admin/application/services.py LIVE_SHIFTS_LIMIT=200, totales sobre filas cortadas |
| U130 | Detalle del ticket no dice quién lo escribió | parcial | arreglo | M | F | support/[id]/page.tsx:153 ya rotula Vos/Usuario/Soporte; falta nombre, rol y acceso a la ficha de quien abrió el ticket |
| U131 | «Ver como»: cartel sin nombre en celular y recargar da «Permisos insuficientes» | vigente | arreglo | M | M | ImpersonationBanner.tsx:25-28 strong truncate colapsa; auth-context sin restaurar la suplantación |
| U132 | Ficha: «No se presentó 1» pero «Todavía no tiene turnos» | vigente | arreglo | M | M | shift.worker_profile_id=None al faltar (entities.py:268-373); la ficha busca por asignado |
| U133 | Admin sin 2FA: errores de fondo y barra de trabajador a la vista | parcial | arreglo | S | N | admin/layout.tsx:119 ya corta el inbox y el menú; falta bottom nav y campanita (NotificationBell) |
| U134 | Ficha de persona en celular corta nombre y mail | vigente | arreglo | S | M | admin/personas/[id]/page.tsx:150-154 truncate |
| U136 | Inicial gigante tapada por nombre de 2 renglones (perfil comercio sin logo) | vigente | arreglo | S | A | companies/[id]/page.tsx:112-124 sin cambios |
| U140 | Con cobro apagado, cambiar de plan reinicia el contador (esquiva el tope) | vigente | decide-Julieta | S | - | subscription/domain/entities.py:103-111 change_plan resetea turnos_usados_mes |
| U141 | Publicar en el tope: borrador por intento y «Ahora no» descarta lo cargado | vigente | diferido | M | - | Depende del tope del plan, apagado en la beta (como U094/U137 en el tablero) |
| U142 | Sin aviso al acercarse al tope del plan fuera de «Mi plan» | vigente | decide-Julieta | M | - | SubscriptionStatusCard.tsx sólo en /subscription |
| U143 | El tope se reinicia a 30 días corridos y «Mi plan» no dice cuándo | vigente | decide-Julieta | M | - | subscription/domain/entities.py:42,82-89 PERIOD_LENGTH |
| U144 | Bloqueos por intentos dicen «Esperá un momento» sin cuánto | vigente | arreglo | S | D | core/rate_limit.py:76 sin Retry-After; identity routes.py:661 sólo el 2FA dice 15 min |

Totales: resuelto 5, parcial 2, vigente 53. decide-Julieta: 10. Diferido: U141. Cerrado por decisión 5: U102.

## Grupos de PRs (arreglo, vigentes o parciales)

### A. Perfil del comercio (2): U119, U136
Archivos: frontend/components/CompanyProfileForm.tsx; backend/app/modules/company/application/{services,dtos}.py; frontend/app/companies/[id]/page.tsx; frontend/app/bienvenida/page.tsx

### B. Dirección, zona y mapa (5): U037, U040, U048, U049, U107
Archivos: frontend/lib/geocoder.ts; frontend/components/map/{MapAddressPicker,MapView}.tsx; frontend/components/LocationPicker.tsx; frontend/app/map/page.tsx; frontend/app/globals.css (solo el foco)

### C. Alta y verificación de mail (4): U041, U042, U043, U122
Archivos: backend/app/modules/identity/api/schemas.py; backend/app/modules/identity/application/services.py (solo reenvío); frontend/app/register/page.tsx; frontend/components/GoogleAuthButton.tsx; frontend/app/verificar-email/page.tsx

### D. Mensajes de error y de límites (2): U113, U144
Archivos: frontend/lib/{errors,api}.ts; backend/app/core/rate_limit.py; backend/app/modules/identity/api/routes.py (solo textos de límite)

### E. Textos y formatos unificados (2): U050, U067
Archivos: frontend/lib/datetime.ts; frontend/lib/shift-share.ts; frontend/components/{Navbar,BottomNav}.tsx; frontend/components/worker/{EnRouteToggle,AvailableNowToggle}.tsx; frontend/lib/types.ts; backend/app/modules/{shift,review}/application/services.py (solo copys)

### F. Chat y soporte (6): U012, U017, U092, U099, U110, U130
Archivos: backend/app/modules/chat/{api/routes,application/services}.py; backend/app/modules/support/** (+ migración Alembic para U110); frontend/app/chats/[shiftId]/page.tsx; frontend/app/chats/layout.tsx; frontend/components/NotificationBell.tsx; frontend/app/support/page.tsx; frontend/app/support/[id]/page.tsx; frontend/lib/types.ts (TicketCategory)

### G. Candidatos, perfil y Buscar (3): U022, U027, U074
Archivos: frontend/app/shifts/[id]/candidates/page.tsx; frontend/app/workers/[id]/page.tsx; frontend/app/search/page.tsx

### H. Matches del trabajador (3): U066, U068, U088
Archivos: backend/app/modules/shift/infrastructure/repositories.py; backend/app/modules/shift/application/services.py (recordatorios con link); frontend/lib/notification-link.ts; frontend/app/my-shifts/page.tsx; frontend/components/worker/OpportunityCard.tsx

### I. Subidas de archivos y perfil del trabajador (3): U051, U052, U091
Archivos: frontend/components/ImageCropModal.tsx; frontend/lib/cloudinary.ts; frontend/components/company/BusinessVerificationCard.tsx; frontend/components/worker/IdentityVerificationCard.tsx; frontend/components/CvUpload.tsx; frontend/components/WorkerProfileForm.tsx

### K. Detalles sueltos de pantalla (4): U044, U046, U047, U061
Archivos: frontend/app/shifts/new/page.tsx; frontend/app/layout.tsx; frontend/lib/pedido-natural.ts; frontend/components/subscription/PlanCard.tsx; frontend/app/subscription/page.tsx

### L. Backend: robustez y privacidad menor (3): U100, U103, U118
Archivos: backend/app/modules/worker/api/routes.py; backend/app/modules/application/application/services.py; backend/app/modules/shift/application/services.py (send_departure_reminder); backend/app/modules/shift/infrastructure/repositories.py (solo versión)

### M. Admin: en vivo, ficha y «Ver como» (4): U129, U131, U132, U134
Archivos: backend/app/modules/admin/application/services.py; backend/app/modules/shift/infrastructure/repositories.py (list_live); frontend/app/admin/en-vivo/page.tsx; frontend/app/admin/personas/[id]/page.tsx; frontend/components/ImpersonationBanner.tsx; frontend/lib/auth-context.tsx

### N. Guardas de rol y 2FA de admin (2): U098, U133
Archivos: frontend/lib/use-require-auth.ts; frontend/app/admin/layout.tsx; frontend/components/BottomNav.tsx; frontend/components/NotificationBell.tsx (cuando 2FA pendiente); frontend/app/{shifts,subscription,favorites,my-shifts}/page.tsx (guarda de rol)

## Paralelo y orden

Se pueden hacer en paralelo (sin archivos en común): A, B, C, D, G, I, K, L, M, F. Salvedades:
- B toca `MapAddressPicker.tsx`; nadie más. K toca `shifts/new/page.tsx`; nadie más.
- D y C tocan archivos distintos de `identity/` (routes.py vs schemas/services): sin choque, pero revisar el merge.
- F y E comparten `frontend/lib/types.ts` (cambios en líneas distintas); F y N comparten `NotificationBell.tsx`.
- H y E comparten `my-shifts/page.tsx` y `shift/application/services.py`; H y L comparten `shift/application/services.py` y `repositories.py`; M y H/L comparten `repositories.py`.
- N y M comparten `admin/layout.tsx`/`auth-context`: N toca el layout, M el banner y el contexto.

Orden recomendado: primera tanda en paralelo A, B, C, G, I, K, F; segunda D, L, M; tercera H y N; última E (toca copys y formatos en muchas pantallas: conviene al final para no pisar a los demás).
Tamaño de cada grupo: S/M salvo F (incluye U110, L: se puede partir y dejar U110 como PR aparte con migración).

## decide-Julieta (pregunta concreta)

- **U018** (Al finalizar el turno, el trabajador no recibe aviso): ¿Avisamos al trabajador cuando el comercio finaliza el turno («Cerró tu turno · Calificalo»)? Opciones: sí, aviso nuevo con push / sí, sólo en la campanita / no.
- **U039** (Google sobre cuenta con clave y mail sin confirmar la «reclama» sin aviso): Google sobre una cuenta con clave y mail sin confirmar: hoy la reclama y anula la clave. ¿Dejarlo así más un mail de aviso al mail de la cuenta / pedir confirmar por mail antes de reclamar / dejarlo sin aviso?
- **U084** (No se puede cancelar un evento entero): ¿Se puede cancelar un evento entero con un solo botón? Opciones: sí, aplicando la misma penalidad y avisos que cancelar cada puesto / sí, sin penalidad si ningún puesto tiene confirmados / no, sigue puesto por puesto.
- **U101** (No hay verificación de edad (fecha de nacimiento / mayores de 18)): /terminos y /privacidad dicen mayores de 18 y que se pide fecha de nacimiento: ¿(a) pedirla y bloquear menores (cambia flujo y versión legal) o (b) corregir el texto para no prometer verificación?
- **U106** (Asistente del trabajador no responde por su verificación): El doc dice que el asistente del trabajador responde por su verificación: ¿(a) lo implementamos o (b) se corrige el doc?
- **U109** (Verificación de identidad sin dorso del DNI): ¿La verificación de identidad pide también el dorso del DNI (obligatorio / opcional) o queda frente y selfie?
- **U111** (Calificación no editable ni borrable; la pantalla no avisa): ¿La calificación es definitiva? Opciones: sí, sólo avisar antes de enviar / editable por 24 h / editable y borrable.
- **U140** (Con cobro apagado, cambiar de plan reinicia el contador (esquiva el tope)): Con cobro apagado, ¿cambiar de plan reinicia el contador (como hoy) o no lo reinicia hasta que el cobro esté activo? (puede quedar diferido como U094/U137).
- **U142** (Sin aviso al acercarse al tope del plan fuera de «Mi plan»): ¿Se avisa al comercio al acercarse al tope del plan fuera de «Mi plan»? Opciones: sí, con 2 o menos turnos restantes / sólo en «Publicar turno» / diferir hasta que el cobro esté activo.
- **U143** (El tope se reinicia a 30 días corridos y «Mi plan» no dice cuándo): ¿El tope del plan se reinicia el día 1 de cada mes (hora AR) o a 30 días corridos con la fecha visible en «Mi plan»?

## Fuera de los grupos
- U141: diferido con el tope del plan (apagado en la beta).
- U102: se cierra solo cuando se apague el ingreso de invitado (decisión 5, etapa 5).
- Resueltos (U059, U116, U117, U121, U087): confirmar con captura renderizada sólo U117.
