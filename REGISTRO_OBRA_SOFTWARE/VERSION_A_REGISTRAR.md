# VERSIÓN A REGISTRAR
## Identificación inequívoca de la obra para el expediente — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. COMMIT RECOMENDADO

### Commit del paquete de documentación (rama de registro)

| Campo | Valor |
|---|---|
| **Hash completo** | `df1236272e442b9a7adb9202c4c49c3d397f1d38` |
| **Hash corto** | `df12362` |
| **Fecha** | Septiembre de 2026 |
| **Mensaje** | `docs: paquete de registro de obra de software (DNDA) para Oído` |
| **Rama** | `registro-obra-software-dnda` |
| **Autor** | Julieta Arrazate \<julietaarrazate@gmail.com\> |

Este commit incorpora la carpeta `REGISTRO_OBRA_SOFTWARE/` con todos los documentos de este expediente, sobre el código funcional ya existente en `main`. Es el punto de referencia ideal para el registro.

## 2. RAMA RECOMENDADA

**Para el registro, la rama de referencia final es `main`.**

Motivo: `main` contiene la versión de producción, desplegada automáticamente en Render y Vercel. La rama `registro-obra-software-dnda` fue creada para el proceso de documentación y se incorporará a `main` mediante un pull request.

**Orden de acción recomendado:**
1. Mergear la rama de documentación a `main` (squash merge del pull request correspondiente).
2. Crear el tag de registro **después** del merge.
3. El tag queda sobre `main`.

## 3. TAG RECOMENDADO

Ver el detalle completo del comando en `TAG_REGISTRO.md`. En síntesis:

```bash
git tag -a dnda-oido-2026-v1 \
  -m "Versión presentada ante la DNDA para registro de obra de software — Oído — Septiembre 2026 — Julieta Arrazate" \
  HEAD   # ejecutar sobre main, después del merge
git push origin dnda-oido-2026-v1
```

| Parámetro | Valor recomendado |
|---|---|
| **Nombre del tag** | `dnda-oido-2026-v1` |
| **Tipo** | Anotado (`-a`) — incluye autor, fecha y mensaje |
| **Rama base** | `main` (después del merge) |

## 4. IDENTIFICACIÓN INEQUÍVOCA DE LA VERSIÓN

| Identificador | Valor | Inmutable |
|---|---|---|
| Hash SHA-1 del commit de documentación | `df1236272e442b9a7adb9202c4c49c3d397f1d38` | Sí (git garantiza integridad) |
| Tag anotado (a crear post-merge) | `dnda-oido-2026-v1` | Sí, una vez pusheado |
| Nombre de la obra | Oído | Sí |
| Fecha | Septiembre 2026 | Sí |
| Rama | `main` (post-merge) | Sí |

## 5. QUÉ INCLUYE ESTA VERSIÓN

El commit `df12362` incluye:

- Todo el código funcional del sistema hasta esa fecha (17 módulos de dominio, 17 routers, 30 migraciones).
- 429 tests automatizados de backend + 75 tests E2E de frontend.
- La carpeta `REGISTRO_OBRA_SOFTWARE/` con la documentación de registro (30-31 archivos).
- 303 commits de historial de desarrollo hasta ese punto.

## 6. INSTRUCCIÓN FINAL

Una vez mergeado el pull request de este expediente a `main`, ejecutar:

```bash
# Verificar que estás en main con el merge aplicado
git checkout main
git pull origin main

# Crear el tag anotado
git tag -a dnda-oido-2026-v1 -m "Registro de obra — Oído — Julieta Arrazate — Septiembre 2026"

# Pushear el tag al repositorio remoto
git push origin dnda-oido-2026-v1

# Verificar
git show dnda-oido-2026-v1
```

El hash que devuelva `git show dnda-oido-2026-v1` es el identificador definitivo de la versión registrada.

---

*Documento elaborado para expediente de registro. Julieta Arrazate — Septiembre 2026*
