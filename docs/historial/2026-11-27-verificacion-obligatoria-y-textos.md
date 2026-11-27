# Verificación obligatoria para ser asignado, y los textos que lo dicen (#755)

**Antes:** verificar la identidad era voluntario: quien no lo hacía igual
podía quedar asignado a un turno, y la portada decía «Verificamos la identidad
de cada trabajador». Los Términos hablaban de cancelar «muy sobre la hora»,
sin número, y no decían nada del tope de avisos (#752). `/privacidad` no decía
que el comercio ve la ubicación en vivo mientras la persona va en camino, ni
quién ve el CV.

**Después:**
- Con `VERIFICACION_OBLIGATORIA=true`, el comercio no puede asignarle un turno
  a quien no tiene la identidad verificada: `POST /shifts/{id}/assign` responde
  409 con un texto que lo explica. Registrarse, mirar y postularse sigue libre.
  Apagada por defecto, como la reconfirmación: se prende en Render.
- A quien se postuló sin verificarse, «Mis turnos → Postulaciones» le avisa
  que le falta y lo lleva a su perfil (`verificacion_requerida` en el perfil
  propio).
- Términos: la verificación hace falta para que te asignen un turno; cancelar
  con menos de 24 horas queda reflejado, y avisar con 24 horas o más no
  cuenta hasta dos veces cada 30 días.
- Privacidad: el comercio ve la ubicación en vivo mientras vas en camino,
  hasta que marcás la llegada (PRI-07); el CV lo ve el comercio con el que
  tenés un turno o una postulación (ADR-0021).
- Versión legal `2026-11-27-1`: todas las cuentas aceptan de nuevo.

**Cómo:** `ShiftService.assign_worker` (`AssigneeNotVerifiedError`), con el
dominio Identity por puerto (`identity_verified`, cableado en
`shift/api/dependencies.py`); `settings.verificacion_obligatoria`;
`WorkerProfileResponse.verificacion_requerida`; aviso en
`frontend/app/my-shifts/page.tsx`. Decisiones de Julieta del 2026-11-26. Del
lado del comercio la verificación sigue voluntaria durante la beta.

**Queda:** en la lista de postulantes, mostrarle al comercio de entrada quién
no puede ser elegido todavía (hoy se entera al tocar «Asignar»), y avisarle a
la persona cuando un comercio quiso elegirla.

**Pruebas:** `backend/tests/test_verificacion_obligatoria.py` (4),
`frontend/e2e/matches-grupo-h.spec.ts` (3 casos nuevos, claro y oscuro).
