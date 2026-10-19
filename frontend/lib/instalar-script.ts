/**
 * Script en línea de la landing: guarda el aviso de Android "se puede
 * instalar" (`beforeinstallprompt`) en `window.__oidoInstalar` aunque llegue
 * antes de que React monte, y avisa con el evento "oido-instalar". Lo usa
 * `useInstalar` (lib/instalar.ts). Va en un archivo aparte, sin "use client",
 * para que la página de servidor reciba el texto y no una referencia.
 */
export const INSTALAR_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__oidoInstalar=e;window.dispatchEvent(new Event("oido-instalar"))});`;
