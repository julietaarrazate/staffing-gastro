import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CvUpload from "./CvUpload";

const uploadCv = vi.fn();

vi.mock("@/lib/cloudinary", () => ({
  uploadCv: (...args: unknown[]) => uploadCv(...args),
}));

beforeEach(() => {
  uploadCv.mockReset();
});

function makeFile(name: string, sizeInBytes: number, type = "application/pdf") {
  return new File([new ArrayBuffer(sizeInBytes)], name, { type });
}

describe("CvUpload", () => {
  it("un archivo de más de 10MB no se sube: muestra error y no llama a uploadCv", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CvUpload value="" fileName={null} token="tok" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = makeFile("cv-gigante.pdf", 11 * 1024 * 1024);
    await user.upload(input, bigFile);

    expect(await screen.findByText(/demasiado pesado.*máximo es 10MB/)).toBeInTheDocument();
    expect(uploadCv).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("un archivo dentro del límite sube normalmente", async () => {
    uploadCv.mockResolvedValue("https://res.cloudinary.com/demo/raw/upload/cv.pdf");
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CvUpload value="" fileName={null} token="tok" onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const okFile = makeFile("cv.pdf", 1 * 1024 * 1024);
    await user.upload(input, okFile);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        "https://res.cloudinary.com/demo/raw/upload/cv.pdf",
        "cv.pdf"
      )
    );
    expect(uploadCv).toHaveBeenCalledWith(okFile, "tok");
  });

  it("un tipo no permitido muestra su propio mensaje y no sube", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<CvUpload value="" fileName={null} token="tok" onChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["x"], "cv.exe", { type: "application/x-msdownload" }));
    expect(await screen.findByText(/tipo de archivo no está permitido/)).toBeInTheDocument();
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("con un CV ya subido ofrece «Reemplazar»", () => {
    render(
      <CvUpload
        value="https://res.cloudinary.com/demo/raw/upload/cv.pdf"
        fileName="cv.pdf"
        token="tok"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Reemplazar" })).toBeInTheDocument();
  });
});
