"use client";

import { EmptyState } from "@/components/ui";
import { MessageIcon } from "@/components/icons";

/**
 * En mobile esta página nunca se ve (el layout muestra la lista de
 * conversaciones en su lugar, ver `layout.tsx`). En desktop es el placeholder
 * del panel derecho cuando todavía no se eligió ninguna conversación de la
 * lista de la izquierda.
 */
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={<MessageIcon size={28} />}
        title="Elegí una conversación"
        subtitle="Seleccioná un chat de la lista para ver los mensajes."
      />
    </div>
  );
}
