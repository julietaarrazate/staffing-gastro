# Sin el isotipo repetido en las pantallas de cuenta (#PR)

**Pedido:** Julieta, 2026-10-19, mirando "Ingresar" en el celular: "no me
gusta que esté repetido, los dos isotipos queda mal".

**Qué ve el usuario:** "Ingresar", "Crear cuenta", "Recuperar contraseña",
"Restablecer contraseña" y "Verificar email" ya no muestran el isotipo
grande arriba del título: la marca queda una sola vez, en el encabezado. En
Términos y Privacidad sale el isotipo chico al lado de "Volver al inicio",
por la misma razón. `/bienvenida` lo conserva porque ahí no hay encabezado.

**Qué cambió (técnico):** se saca `<Logo withWordmark={false} />` (y su
import) de `app/login`, `register`, `recuperar`, `restablecer`,
`verificar-email`, `terminos` y `privacidad`; el título de las pantallas de
cuenta pierde el `mt-4` que lo separaba del logo.
