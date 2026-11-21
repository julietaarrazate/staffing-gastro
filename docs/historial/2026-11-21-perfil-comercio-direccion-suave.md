# El Perfil del comercio con la dirección suave (#PR)

**Pedido:** Julieta, 2026-11-20/21: «toda la app pasa a la misma dirección»;
el Perfil del comercio seguía con la tarjeta y la letra de antes (había
quedado afuera al migrar el de quien trabaja, #705). Vio la propuesta en
capturas y dijo que sí, con el nombre del local como título y el logo que se
cambia desde «Datos del comercio».

**Qué cambió (lo que se ve):** no tenía maqueta; se armó con las piezas del
Perfil de quien trabaja (`T-Perfil`). Responde «¿cómo me ven?»:

- **El cielo** con el nombre del local, su rubro y su barrio, y el lápiz de
  vidrio que lleva a «Datos del comercio».
- **El logo a caballo de la hoja** (sin logo, la inicial) y, con la constancia
  aprobada, el sello «Comercio verificado».
- **La reputación en grande:** la nota, los turnos publicados y el pago a
  tiempo. Es lo que ya ve quien trabaja en la ficha del local; el comercio no
  lo veía en su propio perfil. Sin turnos todavía: «Tu reputación arranca con
  tu primer turno» (no se muestran ceros). Con turnos y sin nota, el número
  grande son los turnos.
- Debajo, lo de siempre: una reseña, la verificación del comercio (arriba
  mientras falta; aprobada, su nota baja al final), las cancelaciones tardías
  y las filas Datos del comercio, Mi plan, Trabajadores favoritos y Ajustes.
- **«A cargo»:** el nombre de la cuenta (se edita ahí) y su mail. Antes era el
  título de la pantalla.

**Lo técnico:** `frontend/components/company/PerfilComercio.tsx` (nuevo; lee
`GET /companies/me/profile`, que ya traía todo; con 404, sin perfil todavía,
muestra el nombre de la cuenta y los accesos, sin error). `LateCancellations`
acepta la cuenta ya leída (`count`, no vuelve a pedir el perfil) y `suave`.
`app/profile/page.tsx` queda sólo con la vista del admin, que migra con
Administración. No hay cambios de backend ni de lógica.

**Por qué así:**

- *El título es el local y no la persona:* es lo que ve quien trabaja. El
  nombre de la persona queda como «A cargo», que es como figura en la ficha.
- *El logo no se cambia tocándolo* (la foto de quien trabaja sí): se cambia en
  «Datos del comercio», donde ya están el recorte y el guardado.
- *Ningún ámbar en la pantalla:* el perfil no tiene una acción principal;
  «Enviar a revisión» de la constancia aparece recién con un archivo elegido.

**Queda abierto:** el Perfil del admin (con Administración); la ficha pública
del comercio (`/companies/[id]`) sigue con el estilo anterior, en su renglón.
