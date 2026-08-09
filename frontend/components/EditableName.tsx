"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui";
import { CheckIcon, CloseIcon, PencilIcon } from "@/components/icons";

/**
 * Nombre del usuario autenticado con edición inline (lápiz → input +
 * guardar/cancelar). Único dato de identidad que hoy queda fijo tanto en el
 * registro por email como en el acceso con Google, sin forma de corregirlo
 * (Julieta, 2026-07-30). El color hereda del contenedor (`className`), así
 * sirve igual sobre fondo claro (perfil del comercio) u oscuro (hero de
 * `WorkerGameCard`).
 */
export default function EditableName({ className = "" }: { className?: string }) {
  const { user, updateFullName } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  function startEditing() {
    setValue(user!.full_name);
    setEditing(true);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === user!.full_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateFullName(trimmed);
      setEditing(false);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo actualizar el nombre"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex items-center gap-1.5"
      >
        {/* autoFocus es intencional acá, no el antipatrón que la regla
            previene (foco inesperado al cargar la página): este input sólo
            aparece cuando el usuario tocó "Editar nombre" — el foco cae
            exactamente donde acaba de pedir escribir. */}
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={255}
          disabled={saving}
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1 text-ink outline-none focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Guardar nombre"
          disabled={saving}
          className="text-success-text disabled:opacity-50"
        >
          <CheckIcon size={18} />
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="text-current opacity-50 disabled:opacity-30"
        >
          <CloseIcon size={18} />
        </button>
      </form>
    );
  }

  return (
    // `flex w-full` (no `inline-flex`): igual que el `<h1>`/`<h2>` que
    // reemplaza, tiene que llenar el ancho del contenedor para que el
    // `truncate` de adentro corte contra ESE ancho — un `inline-flex` se
    // dimensiona a su contenido y nunca llega a recortar (overflow real en
    // /profile con nombres largos, encuadre 390px).
    <button
      type="button"
      onClick={startEditing}
      aria-label="Editar nombre"
      className={`flex w-full items-center gap-1.5 text-left ${className}`}
    >
      <span className="min-w-0 truncate">{user.full_name}</span>
      <PencilIcon size={14} className="shrink-0 opacity-50" />
    </button>
  );
}
