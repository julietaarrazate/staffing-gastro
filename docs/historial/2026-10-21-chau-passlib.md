# Contraseñas con bcrypt directo, sin passlib

**Pedido:** Julieta, el 2026-10-21: sacar `passlib` (propuesta 2 de la
revisión de dependencias del mismo día).

**Qué cambió:** para el usuario, nada. Las contraseñas guardadas siguen
sirviendo y nadie tiene que cambiar la suya. Por dentro:

- `backend/app/core/security.py`: `hash_password` y `verify_password` usan la
  librería `bcrypt` directo, con 12 rondas y prefijo `$2b$`, igual que
  passlib. Un hash con formato inválido ahora devuelve "no verifica" en vez de
  una excepción.
- `backend/requirements.txt`: sale `passlib[bcrypt]==1.7.4` y `bcrypt` sube
  de 4.2.1 a 5.0.0.
- `backend/tests/test_arquitectura_capas.py`: el dominio y los casos de uso no
  pueden importar `bcrypt` (antes la regla nombraba `passlib`).
- `backend/tests/test_password_hashing.py` (nuevo): hashes reales generados
  con passlib 1.7.4 tienen que seguir verificando, incluida una contraseña de
  100 bytes.

**Por qué así:** passlib no tiene versiones desde 2020, así que una falla en
él no la arregla nadie. Además ya da un error al leer la versión de bcrypt 4
y no anda con bcrypt 5. La trampa es el largo: bcrypt sólo mira 72 bytes,
passlib cortaba ahí sin avisar y bcrypt 5 en cambio da error. Las contraseñas
admiten hasta 128 caracteres, así que `security.py` corta a 72 bytes igual
que antes. Sin ese corte, quien tenga una contraseña larga no podría entrar.
Se descartó pasar a Argon2: obliga a re-hashear en cada login y es otro
cambio, que puede ir aparte.

**Queda abierto:** nada.
