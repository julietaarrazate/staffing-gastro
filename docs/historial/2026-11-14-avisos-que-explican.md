# El interruptor de avisos explica por qué no anda (G17, U054) (#573)

**Pedido:** salida a beta, hallazgo U054: con las notificaciones bloqueadas, en un iPhone sin la app instalada o cuando la suscripción fallaba, el interruptor de Ajustes no hacía nada ni decía por qué.

**Qué cambió:** en Ajustes → «Notificaciones push» la fila ahora es siempre verdad:
- permiso bloqueado en el navegador: la fila deja de ser un botón, dice «Bloqueadas» y explica cómo activarlo (candado y Configuración del sitio; en la app instalada de Android, Información de la app; en iPhone, Ajustes → Notificaciones → Oído). Al volver a la pestaña se vuelve a leer el permiso;
- iPhone sin instalar la app (Safari no tiene `PushManager`): «Sin instalar» y «Instalá la app para recibir avisos. Abrí Oído en Safari (otros navegadores del iPhone no pueden instalarla), tocá Compartir y después «Agregar a inicio»…»;
- si activar falla (servidor sin clave VAPID, error de red), aviso flotante rojo «No pudimos activar las notificaciones…» y el interruptor sigue apagado; si la persona rechaza el permiso (sea que `subscribe` devuelva `false` o rechace con `NotAllowedError`), la fila pasa sola a «Bloqueadas» sin aviso de falla. Antes un error de red dejaba la promesa sin atrapar;
- navegador sin soporte y sin nada que hacer (compu vieja): no se muestra, como antes.

Técnica: `frontend/lib/push-estado.ts` (`estadoDePush`, `comoDesbloquear`, lógica pura), `frontend/components/PushToggle.tsx` (reusa `detectarPlataforma`/`estaInstalada` de `lib/instalar.ts` y `useToast`). Pruebas: `lib/push-estado.test.ts`, `components/PushToggle.test.tsx`, `e2e/push-avisos-explica.spec.ts`.

**Por qué así:** una fila no clickeable con la explicación debajo (como la de «Ver como») en vez de un botón que avisa al tocarlo: nunca hay un control que no hace nada. Sin `Notification.permission` no se puede distinguir «rechazado» de «bloqueado por el sistema»; el texto es el mismo camino en ambos casos.

**Queda abierto:** nada de este grupo. `subscribeToPush` sigue devolviendo sólo `false` (no distingue «sin VAPID» de otras fallas): todas dicen lo mismo en el aviso.
