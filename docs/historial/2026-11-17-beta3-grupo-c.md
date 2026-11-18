# Beta etapa 3 · Grupo C: alta y verificación de mail
2026-11-17

## Pedido
Hallazgos U041, U042, U043 y U122 del triaje de la etapa 3.

## Qué cambió
- **U041.** `RegisterRequest` (identity/api/schemas.py) recorta el nombre y rechaza uno vacío («Escribí tu nombre»); rechaza una clave de un solo carácter repetido. Sin más reglas que esas. En `/register` el botón dice qué falta debajo (`lib/registro.ts::motivoBloqueoRegistro`, mismo patrón que `motivoBloqueo` de «Publicar turno»).
- **U042.** Tras el alta con email, `/bienvenida` muestra una vez «Te mandamos un mail para confirmar tu dirección…» (`lib/aviso-mail.ts`, sessionStorage). En `/verificar-email`, con sesión, el botón y el link de abajo van al inicio del rol (`lib/home-del-rol.ts`, que `LandingGate` ahora reusa).
- **U043.** `GoogleAuthButton` recibe `rolElegido` y `terminosAceptados` desde `/register`: con ambos crea la cuenta directo, sin volver a preguntar rol ni mostrar otra casilla; el plan elegido se guarda con el rol del formulario. Sin términos tildados, muestra un aviso y un botón que se habilita al tildar la casilla del formulario. `/login` conserva el paso propio. Texto legal y versión sin cambios; la aceptación se registra igual.
- **U122.** El backend no cambia (la anti-enumeración exige no revelar el límite de 5 min). El texto del front pasa a ser verdadero en ambos casos: «Si corresponde, te mandamos un enlace. Si pediste uno hace poco, esperá unos minutos y revisá la carpeta de spam.»

## Por qué así
La clave repetida se valida en backend (fuente de verdad) y se espeja en el front sólo para explicar el botón. El aviso del mail viaja por sessionStorage porque el alta termina en otra pantalla.

## Queda abierto
- El aviso de mail no se muestra si el ingreso automático queda frenado (va a /login con su aviso fijo, cuyo texto tiene e2e).
- `routes.py` de identity no se tocó (grupo D).
