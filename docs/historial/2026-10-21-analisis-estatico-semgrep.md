# Análisis estático del código en el CI de Security

**Pedido:** Julieta, el 2026-10-21: sumar un escaneo automático del código
propio en cada PR (propuesta 7 de la revisión de dependencias del mismo día).

**Qué cambió:** el usuario no ve nada. En `.github/workflows/security.yml`
hay un job nuevo, `static-analysis`, que corre Semgrep 1.182.0 con las reglas
`p/python`, `p/typescript`, `p/react`, `p/nextjs` y `p/secrets` sobre
`backend/` y `frontend/{app,components,lib}`. Falla con hallazgos de
severidad ERROR. Se documentó en `docs/reference/SECURITY.md`.

**Por qué así:** se propuso CodeQL, pero el repo es privado y en un repo
privado CodeQL pide GitHub Code Security, que es pago. Semgrep es gratis y
corre entero en el runner. Sólo frena con ERROR para no llenar el CI de
ruido. Al arrancar daba 0 ERROR y 3 WARNING, los tres falsos positivos:

- el SHA-1 de `backend/app/core/cloudinary.py`, que es el algoritmo que
  exige la firma de Cloudinary;
- el log de `backend/app/core/turnstile.py`, que lleva la IP y no el token;
- el log de `identity/infrastructure/google_token_verifier.py`, que lleva el
  error de conexión.

Se probó que frena de verdad: un archivo de prueba con
`subprocess.call(cmd, shell=True)` hizo fallar el escaneo, y se borró.

**Queda abierto:** nada.
