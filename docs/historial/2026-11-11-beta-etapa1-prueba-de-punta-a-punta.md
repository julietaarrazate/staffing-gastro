# Salida a beta, etapa 1: prueba de punta a punta y el entorno para repetirla

**Pedido:** Julieta, 2026-11-11: lanzar la beta con la menor cantidad posible
de errores, en seis etapas. La primera es usar la app como la usaría una
persona, de punta a punta, **sin arreglar nada**, y entregar la lista de
problemas por gravedad con evidencia, más la lista de pruebas que tiene que
hacer una persona. La beta sale bien si un comercio real publica un turno y
un trabajador real lo cubre en menos de 10 minutos sin trabarse.

**Qué cambió:** nada del producto. Este PR deja en el repo el entorno con el
que se hizo la prueba, para repetirla después de arreglar:

- `tools/e2e-local/`: backend real y Postgres local, con los servicios de
  terceros simulados (mails, ingreso con Google, Cloudinary, Gemini,
  buscador de direcciones, mapa base y avisos push), más un kit de Playwright
  (`kit.mjs`) para manejar sesiones en 390 y 1280 px, en claro y oscuro. Se
  levanta con `setup.sh` y `start_all.sh`; el detalle está en su `README.md`.
  No toca `backend/` ni `frontend/`: los terceros se redirigen desde un
  lanzador (`run_backend.py`) y desde las rutas del navegador de prueba.
- `docs/reference/SESION_CLOUD.md` §7 y §8: la receta para usarlo y lo que
  costó aprender (el límite de uso corta todos los subagentes a la vez; el
  contenedor se reinicia y hay que volver a levantar la base).
- `docs/reference/MAPA_DEL_CODIGO.md`: la fila del entorno.

**Qué se probó:** el build de producción del frontend contra ese backend, con
cuentas creadas ahí. Dieciséis recorridos (comercio, trabajador, los dos a la
vez con dos sesiones, casos que rompen, admin, y una corrida aparte con el
límite de intentos y el tope del plan prendidos). De 226 anotaciones quedaron
**142 problemas distintos: 3 bloqueantes, 79 graves y 60 menores.** Hubo 102
verificaciones independientes (reproducir desde cero con cuentas nuevas y
leer el código): 82 confirmadas, 17 confirmadas en parte y 3 que estaban
decididas así en un ADR. Ninguna resultó falsa; dos se descartaron por ser
decisiones ya escritas.

Con los dos mirando la app, cubrir un turno lleva 44 segundos (mediana de
tres corridas): 15 toques del comercio y 9 del trabajador, y unos 7 segundos
de la app. El riesgo para los 10 minutos está en los tres relevos entre
personas, que dependen del aviso al celular si la app está cerrada.

**La lista no está en el repo.** El repo es público y entre los hallazgos hay
problemas de privacidad sin arreglar. Está en un documento privado de
Julieta, con captura, pasos y archivo y línea de cada uno:
https://claude.ai/artifact/Fg8FYTDexBaVDi49rCZ1Rh. Una sesión futura lo lee
con la herramienta de artifacts.

**Por qué así:** los E2E del repo corren con toda la API simulada
(`frontend/e2e/`), y los tests del backend no pasan por la pantalla. Nadie
había recorrido el camino completo con las dos mitades conectadas, que es lo
que define si la beta sale bien. Se simularon los terceros porque desde el
contenedor no hay salida a ellos (ni a producción), y porque la regla era no
escribir en ningún servicio real. La simulación prueba que la app llama bien
y reacciona bien; no prueba al tercero. Por eso existe la lista de pruebas
para una persona (push real, GPS real, pago real, instalar la app, Google
real, mails en la bandeja, IA real).

Se descartó guardar el arnés dentro de `backend/scripts/`: dispararía el
pytest completo y el análisis estático en cada cambio suyo, y no es código
del producto.

**Queda abierto:** la etapa 2 (arreglar primero los bloqueantes y después
los graves, un problema por PR con su test, y repetir los caminos A, B y C
con este entorno) y las pruebas en un celular real. Está en
`../STATUS.md`. Seis hallazgos menores de la corrida con el tope del plan
quedaron sin segunda verificación; el documento lo marca en cada uno.
