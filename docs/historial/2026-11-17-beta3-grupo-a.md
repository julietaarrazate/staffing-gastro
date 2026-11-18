# Beta etapa 3, grupo A: perfil del comercio

**Pedido:** triaje de la etapa 3 de la beta, hallazgos U119 y U136.

**Qué cambió:**
- U119: guardar «Datos del comercio» ya no borra rubro, descripción, capacidad ni horarios. El backend trata `category`, `description`, `capacity` y `opening_hours` como la foto del local: si el pedido no los trae no se tocan, y `null` explícito sí los vacía (`UNSET` en `company/application/dtos.py`, `services._apply`, `api/routes._to_data`). `CompanyProfileForm` no los manda a propósito. En `/bienvenida`, el PUT de la cuenta invitada manda esos cuatro en `null` para seguir arrancando de cero. Tests en `backend/tests/test_company.py`.
- U136: en `/companies/[id]` sin foto ni logo, la inicial va arriba y el nombre debajo, en el flujo; la tarjeta crece con nombres largos y ya no se tapan.

**Por qué así:** reusar el mecanismo `UNSET` ya existente para la foto del local, en vez de que el form relea y reenvíe todo (que dejaría una ventana de pisado entre pantallas). El pedido de reemplazo total que mandaba todo sigue funcionando igual.

**Queda abierto:** nada.
