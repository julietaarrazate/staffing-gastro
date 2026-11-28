import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { avisoPostulacion, estadoPostulado, textoPostularse, useConfirmarPuedoIr } from "./ConfirmarPuedoIr";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

describe("textos del carril urgente", () => {
  it("con apply_commits: «Puedo ir ya»; sin él, «Postularme»", () => {
    expect(textoPostularse({ apply_commits: true })).toBe("Puedo ir ya");
    expect(textoPostularse({ apply_commits: false })).toBe("Postularme");
    expect(textoPostularse({})).toBe("Postularme");
  });

  it("el estado después de postularse cambia sólo si compromete", () => {
    expect(estadoPostulado(true)).toEqual({
      titulo: "Te ofreciste para este turno.",
      detalle: "Si te aceptan, queda confirmado.",
    });
    expect(estadoPostulado(false).titulo).toBe("Ya te postulaste");
    expect(avisoPostulacion({ apply_commits: false })).toBe("¡Te postulaste! El comercio ya te puede ver");
  });
});

function Prueba({ onResultado }: { onResultado: (ok: boolean) => void }) {
  const { confirmar, dialogo } = useConfirmarPuedoIr();
  const turno = { start_at: "2026-11-27T20:00:00-03:00" };
  return (
    <>
      <button onClick={() => confirmar({ ...turno, apply_commits: true }).then(onResultado)}>urgente</button>
      <button onClick={() => confirmar({ ...turno, apply_commits: false }).then(onResultado)}>comun</button>
      {dialogo}
    </>
  );
}

describe("useConfirmarPuedoIr", () => {
  it("un turno que no compromete resuelve true sin abrir nada", async () => {
    const onResultado = vi.fn();
    render(<Prueba onResultado={onResultado} />);
    await userEvent.click(screen.getByRole("button", { name: "comun" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onResultado).toHaveBeenCalledWith(true);
  });

  it("uno que compromete pregunta con el texto acordado y resuelve según el botón", async () => {
    const onResultado = vi.fn();
    render(<Prueba onResultado={onResultado} />);
    await userEvent.click(screen.getByRole("button", { name: "urgente" }));
    expect(screen.getByRole("heading", { name: "¿Podés ir a este turno?" })).toBeInTheDocument();
    expect(screen.getByTestId("confirmar-puedo-ir")).toHaveTextContent(
      /^Empieza .+\. Si el comercio te acepta, el turno queda confirmado en el momento: no vas a tener que confirmar de nuevo\.$/
    );
    expect(onResultado).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(onResultado).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByRole("button", { name: "urgente" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, puedo ir" }));
    expect(onResultado).toHaveBeenLastCalledWith(true);
  });
});
