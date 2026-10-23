# CI valida la cadena de migraciones de Alembic

**Pedido:** Julieta, 2026-10-22: sacar la deuda técnica. Salió del cierre de
la noche de PRs en paralelo (#491–#504).

**Qué cambió:** nada visible. `backend/tests/test_cadena_migraciones.py`
lee `alembic/versions/` con `ScriptDirectory` (sin base de datos) y falla si:

- algún `down_revision` apunta a una migración que no está en la rama;
- hay más de una cabeza;
- dos archivos declaran la misma revisión, o el número del nombre del archivo
  no coincide con su `revision`.

**Por qué así:** los tests arman el esquema con `create_all` y nunca recorren
la cadena; Render sí la recorre (`alembic upgrade head`) al deployar. El PR
del cobro (#497) tuvo `down_revision = "0041"` cuando la 0041 todavía no
estaba en su rama, y el CI dio verde. Lo frenó el orden de merge manual.
Ahora ese error, dos cabezas o un número repetido entre ramas paralelas
salen en el CI del PR y no en el deploy. Se probó rompiendo la cadena de las
tres formas: cada una hace fallar el test con un mensaje que dice qué pasa.

**Queda abierto:** nada. La fricción quedó archivada en EKP (cycle 55, P7-21).
