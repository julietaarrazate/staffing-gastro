# G8: errores de validación que se entienden (U030, U031) (#PR)

**Pedido:** salida a beta, grupo G8. Los 422 de Pydantic (mail sin dominio, texto corto o largo, cantidad 51, mensaje de chat largo) salían como «Error inesperado».

**Qué cambió:** el servidor rechaza con un texto que se lee: «Mail: tiene que ser un mail válido», «Mensaje: máximo 2000 caracteres», «Cantidad: entre 1 y 50». Los campos ya traen los mismos límites que el servidor, así que casi nunca se llega al error. El error de «Llegué» y «Me fui» sale como aviso flotante, no como banner arriba de la lista.
- `frontend/lib/api.ts` (`parseErrorDetail`): lee el `detail` en forma de lista y traduce por `type` de Pydantic v2 usando `ctx` y el último segmento de `loc` (diccionario `FIELD_NAMES`). Tipo sin traducción: «Revisá los datos.». Nunca muestra el `msg` en inglés ni el valor enviado. Siguen igual `zona_requerida` y el `detail` con `{code, message}`. Varios errores se unen con « · » (hasta 3).
- `frontend/lib/limites.ts` (nuevo): `LIMITES` y `RANGOS_NUMERICOS`, sacados de `Field(...)` de los `api/schemas.py`. Aplicados en chat, registro (nombre y contraseña), publicar turno (pedido al asistente, dress code, pago), evento (nombre, dress code, cantidad 1 a 50), perfil del trabajador (años 0 a 80, presentación), comercio (nombre), bienvenida y nombre editable. `TextField` ganó la prop `step`.
- `frontend/app/my-shifts/page.tsx`: `act()` avisa con `toast` en todos los errores (también los de ubicación); se sacó el banner `geoError` con su «Reintentar» (se vuelve a tocar el botón).
- Pruebas: unitarias de `parseErrorDetail` con la forma real de cada 422; `e2e/errores-de-validacion.spec.ts` (registro, chat, «Llegué»).

**Por qué así:** se traduce por tipo y no por el texto porque el `msg` de Pydantic está en inglés y puede variar. Para «Entre 1 y 50» el 422 sólo trae una cota, así que el rango del campo vive en `RANGOS_NUMERICOS`. Un `value_error` que no es de mail muestra `ctx.error`, el texto en castellano de los validadores propios del backend.

**Lo que encontró la revisión independiente (arreglado acá):** el backend
sacaba a propósito todo el `ctx` de los 422 (`backend/app/main.py`, con un
test de seguridad que lo exigía), así que el frontend nunca recibía las cotas:
una contraseña de 5 letras decía «no puede estar vacío». Ahora del `ctx` viajan
**sólo las cotas numéricas del esquema** (`_CTX_PERMITIDO`: `min_length`,
`max_length`, `ge`, `le`, `gt`, `lt`, `max_digits`, `decimal_places`), nunca el
valor enviado ni el texto de un validador (puede repetir lo que se mandó); los
tests de seguridad lo fijan. Por lo mismo, el texto de un `value_error` no se
muestra (salvo el del mail, reconocido por el campo): sale «Revisá los datos.».
Los campos de pago ya no llevan `step={1}` (el servidor acepta centavos), y el
error de ubicación de «Llegué» queda 8 segundos a la vista en vez de 3,2.

**Queda abierto:** el aviso de «Llegué» perdió el botón «Reintentar». Los mensajes de dominio del turno en castellano de persona son G9. Campos sin esquema o sin tope en el servidor (mail, idiomas, certificaciones) no tienen límite en pantalla.
