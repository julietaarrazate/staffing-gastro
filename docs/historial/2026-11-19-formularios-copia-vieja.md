# Los formularios de perfil mandan sólo lo que la persona tocó (#675)

**Pedido:** pasada por clase de error del 2026-11-19, hallazgos menores ESC-02
(comercio) y ESC-03 (trabajador): formularios que mandan el recurso entero
armado con la copia de cuando se abrieron.

**Qué cambió:** lo que ve la persona:

- Editar el perfil del trabajador y guardar otro campo ya no revierte
  «Disponible» ni la zona que se cambiaron desde el Inicio o el Mapa mientras
  el formulario estaba abierto.
- Editar el perfil del comercio y guardar ya no pisa el logo, la dirección ni
  la ubicación que se guardaron desde otra pestaña o pantalla.

Lo técnico:

- `frontend/components/WorkerProfileForm.tsx`: guarda un `loadedFields` (lo
  cargado o lo último guardado) y `changedFields(now, loaded)` devuelve sólo lo
  distinto; la zona (ciudad + coordenadas) viaja junta. Eso va a
  `saveProfilePart`, que pone lo que tiene el servidor para el resto. El CV
  sigue con `sameCv` (cambio previo). Perfil nuevo (POST): se manda todo.
- `frontend/lib/company-profile.ts` (nuevo): `saveCompanyProfilePart(token,
  cambios)` lee el perfil del servidor y manda nombre, logo, dirección, ciudad y
  coordenadas de ahí con los cambios encima; la portada sólo va si cambió (el
  backend ya trata lo omitido como «no tocar»). `CompanyProfileForm.tsx` hace el
  mismo diff (`changedCompanyFields`).
- Tests: `WorkerProfileForm.copia-vieja.test.tsx`,
  `CompanyProfileForm.copia-vieja.test.tsx` y
  `e2e/formulario-perfil-copia-vieja.spec.ts`.

**Por qué así:** sin endpoint nuevo. El `PUT /companies/me/profile` ya admite
omitir portada, rubro, descripción, capacidad y horarios, pero escribe siempre
nombre, logo, dirección, ciudad y coordenadas; hacer parcial también eso en el
backend es el arreglo de fondo (igual que el PATCH del perfil del trabajador) y
no hacía falta para cerrar estos dos casos.

**Queda abierto:** la ventana de milisegundos entre leer y escribir en ambos
helpers (sólo la cierra un guardado parcial en el backend). Un campo que la
persona edita en el formulario y que otra pantalla cambió a la vez gana lo del
formulario (es lo que ella escribió).
