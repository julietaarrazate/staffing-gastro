# El acceso en la compu: la pantalla entera en dos columnas

**Pedido:** Julieta, 2026-11-24: en la compu la app se ve como en el celular; empezar la versión de
escritorio (decisión B: todas las pantallas) por la navegación común y el login.

**Qué cambió:** desde 1024 px de ancho, las pantallas de acceso (`/login`, `/register`, `/recuperar`,
`/restablecer`, `/verificar-email`) y la bienvenida ocupan la pantalla entera partida en dos (primero se
probó un recuadro del ancho del marco, `--app-frame`; Julieta prefirió la pantalla completa): a la izquierda, el cielo grande con el «oído», el título (44 px, `--text-display`),
qué es Oído en tres frases y dos fotos de la landing (`mozo3`, `cocina1`); a la derecha, la hoja con el
formulario centrado (hasta 400 px), sobre la hoja de borde a borde. Antes era una tarjeta de celular chica en el medio de una pantalla vacía. En el
celular y la tablet no cambia nada: todo va detrás de `lg:`.

Técnico: `frontend/components/acceso/PantallaAcceso.tsx` (`QueEsOido`, oculto debajo de `lg`; sin sesión
ocupa `100dvh`, con sesión descuenta el encabezado) y dos reglas en `app/globals.css` desde 1024 px
(`.acceso .titulo-pantalla` y la hoja sin esquinas).

**Por qué así:** el acceso es lo primero que ve cualquiera, comercio o trabajador; en la compu sobraba
pantalla y el lado izquierdo la usa para decir qué es Oído sin agregar texto en el celular, donde el
formulario va primero. Las frases son las ya aprobadas («publicás en un minuto», confirmado el 22/11; la
verificación es opcional, por eso «se ve quién la tiene»).

**Navegación (renglón 0):** ya existía la barra de arriba de la compu y el marco de 1024 px con su test;
lo que falta en las demás pantallas es aprovechar el ancho adentro (una columna de celular estirada).

**Revisión independiente** (otro agente, 126 capturas en 7 anchos y los dos temas): nada bloqueante.
Se aplicó: el bloque «qué es Oído» sólo sin sesión (no en la bienvenida ni al confirmar el email
estando adentro), el título más abajo para que no lo pise la nube, la sombra de las fotos con el token
`--shadow-float` y una prueba nueva del diseño en compu (`e2e/acceso-en-compu.spec.ts`). Las tres
frases se quedan: son las promesas aprobadas en el documento de crecimiento («publicás en un minuto»,
confirmado por Julieta el 22/11).

**Pruebas:** e2e del acceso, la bienvenida, el origen del alta y los anchos (52 de 52); Vitest
completo (1236); typecheck y lint sin errores. Capturas a 1440, 1024 y 390 px, en claro y oscuro.

**Queda abierto:** el resto de las pantallas, en el orden de
[`planning/ESCRITORIO_PANTALLAS.md`](../planning/ESCRITORIO_PANTALLAS.md).
