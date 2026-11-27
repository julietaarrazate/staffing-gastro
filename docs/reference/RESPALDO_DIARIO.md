# Copia diaria de la base de producción

**Para qué.** El plan gratuito de Neon deja restaurar sólo las últimas 6
horas. Esta copia cubre lo que quede más atrás: un volcado completo por noche,
guardado 30 días, sin costo.

**Dónde vive.** En un repositorio **privado** aparte (`oido-respaldos`), no en
éste: este repositorio es público y los archivos que sube una corrida de
GitHub Actions se pueden descargar desde afuera. Cada copia va además cifrada,
así que ni siquiera quien entre a ese repositorio la lee sin la frase.

**Qué hace cada noche (03:17 de Buenos Aires).**
1. Vuelca la base con `pg_dump` de la misma versión que Neon (17).
2. Comprueba que el volcado se pueda leer y que no esté vacío.
3. Lo cifra con una frase (AES-256).
4. Lo guarda 30 días como archivo de la corrida.

Si una corrida falla, GitHub le manda un mail a la dueña del repositorio.

## Los dos secretos del repositorio privado

| Secreto | Qué es |
|---|---|
| `DATABASE_URL` | La cadena de conexión **directa** de Neon (sin `-pooler`) del proyecto `staffya-us-east`, rama `main`. |
| `BACKUP_PASSPHRASE` | Una frase larga inventada para cifrar. **Guardarla en el gestor de contraseñas:** sin ella las copias no se pueden abrir. |

## El archivo `.github/workflows/respaldo.yml`

```yaml
name: Respaldo diario de la base

on:
  schedule:
    - cron: "17 6 * * *" # 03:17 en Buenos Aires
  workflow_dispatch:

permissions:
  contents: read

jobs:
  respaldo:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Volcar, comprobar y cifrar
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BACKUP_PASSPHRASE: ${{ secrets.BACKUP_PASSPHRASE }}
        run: |
          set -euo pipefail
          test -n "$DATABASE_URL" || { echo "Falta el secreto DATABASE_URL"; exit 1; }
          test -n "$BACKUP_PASSPHRASE" || { echo "Falta el secreto BACKUP_PASSPHRASE"; exit 1; }
          FECHA=$(date -u +%Y-%m-%d)
          docker run --rm -e PGURL="$DATABASE_URL" postgres:17 \
            sh -c 'pg_dump "$PGURL" --format=custom --no-owner --no-privileges' > oido.dump
          # Un volcado vacío o cortado no sirve: se comprueba antes de guardarlo.
          test "$(stat -c%s oido.dump)" -gt 100000
          TABLAS=$(docker run --rm -v "$PWD":/w postgres:17 pg_restore --list /w/oido.dump | grep -c "TABLE DATA")
          echo "Tablas con datos en el volcado: $TABLAS"
          test "$TABLAS" -gt 10
          gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
            --symmetric --cipher-algo AES256 -o "oido-$FECHA.dump.gpg" oido.dump \
            3<<<"$BACKUP_PASSPHRASE"
          rm oido.dump
          ls -l oido-*.dump.gpg
      - name: Guardar la copia 30 días
        uses: actions/upload-artifact@v7
        with:
          name: oido-${{ github.run_id }}
          path: oido-*.dump.gpg
          retention-days: 30
          if-no-files-found: error
          compression-level: 0
```

## Cómo se restaura una copia

Nunca sobre producción directamente: primero a una rama nueva de Neon, se
mira, y recién después se decide.

1. En el repositorio privado: Actions → la corrida del día → descargar el
   archivo `oido-…`.
2. Descifrar: `gpg --decrypt oido-AAAA-MM-DD.dump.gpg > oido.dump` (pide la
   frase).
3. En Neon, crear una rama nueva vacía o un proyecto de prueba y copiar su
   cadena de conexión.
4. `pg_restore --no-owner --no-privileges --dbname "<cadena de la rama nueva>" oido.dump`
5. Revisar los datos ahí. Pasar algo a producción es una decisión aparte.

## Límites

- Guarda una copia por día: lo que pase entre dos copias y quede fuera de las
  6 horas de Neon no se recupera.
- No cubre los archivos de Cloudinary (fotos, CV), sólo la base.
- El plan gratuito de GitHub alcanza de sobra hoy (una corrida de un par de
  minutos por día y copias de pocos megas). Si la base crece mucho, bajar los
  días de retención.
