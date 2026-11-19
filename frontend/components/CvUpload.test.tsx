import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvUpload, { NO_CV } from "./CvUpload";

const uploadCv = vi.fn();

vi.mock("@/lib/cloudinary", () => ({
  uploadCv: (...args: unknown[]) => uploadCv(...args),
}));

beforeEach(() => {
  uploadCv.mockReset();
});

const REF = {
  public_id: `oido/cv/${"d".repeat(64)}`,
  resource_type: "image",
  format: "pdf",
  type: "authenticated" as const,
};

function makeFile(name: string, sizeInBytes: number, type = "application/pdf") {
  return new File([new ArrayBuffer(sizeInBytes)], name, { type });
}

describe("CvUpload", () => {
  it("un archivo de más de 10MB no se sube: muestra error y no llama a uploadCv", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CvUpload value={NO_CV} token="tok" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = makeFile("cv-gigante.pdf", 11 * 1024 * 1024);
    await user.upload(input, bigFile);

    expect(await screen.findByText(/demasiado pesado.*máximo es 10MB/)).toBeInTheDocument();
    expect(uploadCv).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("un archivo dentro del límite sube privado y queda como referencia, no como URL", async () => {
    uploadCv.mockResolvedValue(REF);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CvUpload value={NO_CV} token="tok" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const okFile = makeFile("cv.pdf", 1 * 1024 * 1024);
    await user.upload(input, okFile);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ file: REF, url: "", fileName: "cv.pdf" })
    );
    expect(uploadCv).toHaveBeenCalledWith(okFile, "tok");
  });

  it("un tipo no permitido muestra su propio mensaje y no sube", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<CvUpload value={NO_CV} token="tok" onChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["x"], "cv.exe", { type: "application/x-msdownload" }));
    expect(await screen.findByText(/tipo de archivo no está permitido/)).toBeInTheDocument();
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("con un CV ya subido ofrece «Reemplazar» y «Quitar»", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CvUpload value={{ file: REF, url: "", fileName: "cv.pdf" }} token="tok" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Reemplazar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("O pegá un link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar CV" }));
    expect(onChange).toHaveBeenCalledWith(NO_CV);
  });

  it("un CV viejo (URL pública de Cloudinary) también se muestra como archivo", () => {
    render(
      <CvUpload
        value={{ file: null, url: "https://res.cloudinary.com/demo/raw/upload/cv.pdf", fileName: null }}
        token="tok"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reemplazar" })).toBeInTheDocument();
  });

  it("el CV guardado se abre con el link que vence; si falla, lo dice", async () => {
    const onOpen = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <CvUpload value={{ file: REF, url: "", fileName: "cv.pdf" }} token="tok" onChange={vi.fn()} onOpen={onOpen} />
    );
    await user.click(screen.getByRole("button", { name: "cv.pdf" }));
    expect(onOpen).toHaveBeenCalled();
    expect(await screen.findByText(/No pudimos abrir el CV/)).toBeInTheDocument();
  });

  it("uno recién subido (sin guardar) no se puede abrir todavía", () => {
    render(<CvUpload value={{ file: REF, url: "", fileName: "cv.pdf" }} token="tok" onChange={vi.fn()} />);
    expect(screen.getByText("cv.pdf").tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: "cv.pdf" })).not.toBeInTheDocument();
  });
});
