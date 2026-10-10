#!/bin/sh
# "Ignored Build Step" de Vercel (`ignoreCommand` en frontend/vercel.json).
# Corre en frontend/ (el Root Directory del proyecto) antes de cada build.
#
# Vercel lee el código de salida así: 0 = saltear el build, 1 = buildear, y
# CUALQUIER OTRO (p. ej. el 128 de un `git diff` contra un commit que no
# existe) = el deploy falla con error. Por eso este script sólo sale con 0 o
# 1, y ante la duda buildea. Pasó el 2026-10-10: la rama se había rehecho
# desde main, el último deploy apuntaba a un commit que ya no estaba, y
# `git diff` cortó el deploy con "fatal: bad object".

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base="HEAD^"
fi

if git diff --quiet "$base" HEAD -- . 2>/dev/null; then
  echo "Sin cambios en frontend/ desde $base: se saltea el build."
  exit 0
fi

echo "Hay cambios en frontend/ desde $base (o no se pudo comparar): se buildea."
exit 1
