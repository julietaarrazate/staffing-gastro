"use client";

// Los códigos de recuperación de la verificación en dos pasos, la única vez
// que se muestran (ADR-0023): copiarlos o bajarlos en un .txt.

import { useState } from "react";
import { recoveryCodesText } from "@/lib/two-factor";
import { Button } from "@/components/ui";
import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/icons";

export default function RecoveryCodesPanel({ codes, email }: { codes: string[]; email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permiso de portapapeles: quedan a la vista y se pueden bajar.
    }
  }

  function download() {
    const blob = new Blob([recoveryCodesText(codes, email, new Date())], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oido-codigos-de-recuperacion.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <ul
        aria-label="Códigos de recuperación"
        className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-surface p-4 font-mono text-sm text-ink ring-1 ring-line"
      >
        {codes.map((code) => (
          <li key={code} className="select-all tabular-nums">
            {code}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          variant="surface"
          size="sm"
          onClick={copy}
          leftIcon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        >
          {copied ? "Copiados" : "Copiar"}
        </Button>
        <Button variant="surface" size="sm" onClick={download} leftIcon={<DownloadIcon size={16} />}>
          Descargar
        </Button>
      </div>
    </div>
  );
}
