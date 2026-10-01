# TAG DE REGISTRO GIT
## Identificación permanente de la versión presentada ante la DNDA — Oído

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. EL TAG A CREAR

```
Nombre:   dnda-oido-2026-v1
Tipo:     Anotado (contiene autor, fecha y mensaje)
Commit:   df1236272e442b9a7adb9202c4c49c3d397f1d38 (sobre la rama de
          documentación; se recomienda re-crearlo sobre el commit
          equivalente en main tras el merge — ver sección 4)
Mensaje:  Versión presentada ante la DNDA para registro de obra de
          software — Oído — Septiembre 2026 — Julieta Arrazate
```

## 2. POR QUÉ ESTE COMMIT Y NO EL PRIMERO

### El primer commit no es un buen punto de referencia para el registro

El primer commit del repositorio (21 de junio de 2026) es sólo el punto de partida de la Fase 1 del sistema (autenticación, perfiles, publicación de turnos). El tag no dice "el proyecto empezó aquí": dice "en este punto exacto presenté el registro".

### El commit elegido representa el estado completo de la obra al momento del registro

El commit `df12362` (rama `registro-obra-software-dnda`) contiene:

- Todo el código fuente funcional del sistema hasta la fecha (backend + frontend).
- Los 30-31 documentos de este expediente (`REGISTRO_OBRA_SOFTWARE/`).

Es el estado más completo y coherente: **el software que se registra + el expediente que lo describe**, en un único punto identificable.

## 3. QUÉ GARANTIZA UN TAG ANOTADO

A diferencia de una rama (que avanza con cada commit), un tag anotado es **inmutable**: una vez creado y publicado, siempre apunta al mismo commit. Git garantiza la integridad del contenido mediante SHA-1: si alguien modifica un solo byte del repositorio, el hash cambia.

Esto permite verificar en cualquier fecha futura:

```bash
git show dnda-oido-2026-v1 --stat
# → muestra exactamente qué archivos existían en el momento del registro
```

## 4. CÓMO CREAR Y PUBLICAR EL TAG

**Recomendado:** crear el tag sobre `main`, después de mergear el pull request de este expediente — así queda sobre la rama de producción real, no sobre una rama de trabajo temporal.

```bash
# Desde el repo clonado, después de mergear el PR a main
git checkout main
git pull origin main

git tag -a dnda-oido-2026-v1 \
  -m "Versión presentada ante la DNDA para registro de obra de software — Oído — Septiembre 2026 — Julieta Arrazate"

git push origin dnda-oido-2026-v1
```

**Alternativa — crear el tag directamente sobre este commit** (si se prefiere no esperar al merge):

```bash
git tag -a dnda-oido-2026-v1 df1236272e442b9a7adb9202c4c49c3d397f1d38 \
  -m "Versión presentada ante la DNDA para registro de obra de software — Oído — Septiembre 2026 — Julieta Arrazate"
git push origin dnda-oido-2026-v1
```

## 5. VERIFICACIÓN DESPUÉS DE PUBLICAR

```bash
# Verificar que el tag existe en el remoto
git ls-remote --tags origin | grep dnda

# Ver el contenido completo del tag
git show dnda-oido-2026-v1

# Ver qué archivos incluye
git show dnda-oido-2026-v1 --stat
```

## 6. CONSERVAR COMO EVIDENCIA

Guardar en el expediente:

| Dato | Valor |
|---|---|
| Nombre del tag | `dnda-oido-2026-v1` |
| Hash del commit de documentación | `df1236272e442b9a7adb9202c4c49c3d397f1d38` |
| Repositorio | `julietaarrazate/staffing-gastro` (privado) |
| Rama de origen del expediente | `registro-obra-software-dnda` |
| Rama final recomendada para el tag | `main` (post-merge) |

Este hash es el identificador definitivo de la versión registrada. Es inmutable y verificable en cualquier momento.

---

*Documento elaborado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
