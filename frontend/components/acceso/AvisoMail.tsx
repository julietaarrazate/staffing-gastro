"use client";

import { useState } from "react";
import { api, isRateLimited, RATE_LIMITED_MESSAGE } from "@/lib/api";

/**
 * Aviso de la bienvenida tras el alta con email y contraseña. El alta no sabe
 * si el mail llegó a salir (el envío es aparte y puede fallar sin que la
 * persona lo vea), así que NO afirma que se mandó: dice qué se está haciendo,
 * muestra a qué dirección, y ofrece la salida (revisar que esté bien escrita
 * y pedirlo de nuevo con el mismo `POST /auth/resend-verification` que usa
 * `/verificar-email`, que no revela si la cuenta existe).
 */
export default function AvisoMail({ email }: { email: string }) {
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState(false);
  const [limitado, setLimitado] = useState(false);

  async function reenviar() {
    setEnviando(true);
    setLimitado(false);
    try {
      await api.post("/auth/resend-verification", { email });
      setPedido(true);
    } catch (err) {
      // Anti-enumeración: sólo el límite de intentos se distingue; el resto se
      // trata como un pedido hecho, igual que en `/verificar-email`.
      if (isRateLimited(err)) setLimitado(true);
      else setPedido(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="status"
      data-testid="aviso-mail"
      className="mb-4 rounded-2xl bg-[var(--suave-campo)] px-4 py-3 text-sm text-ink-soft"
    >
      <p>
        Estamos mandando un mail para confirmar <strong className="break-words text-ink">{email}</strong>. Si no te
        llega en unos minutos, revisá la carpeta de spam y que la dirección esté bien escrita.
      </p>
      {pedido ? (
        <p data-testid="aviso-mail-pedido" className="mt-2 font-medium text-ink">
          Pedido enviado. Si la dirección es correcta, en unos minutos te llega.
        </p>
      ) : (
        <button
          type="button"
          onClick={reenviar}
          disabled={enviando}
          className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary-text underline underline-offset-2 disabled:opacity-60"
        >
          {enviando ? "Pidiendo…" : "Pedir el mail de nuevo"}
        </button>
      )}
      {limitado && (
        <p role="alert" className="mt-1 text-danger-text">
          {RATE_LIMITED_MESSAGE}
        </p>
      )}
    </div>
  );
}
