import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RatingOrNew from "./RatingOrNew";

describe("RatingOrNew", () => {
  it("sin reseñas: «Nuevo en Oído», sin estrellas ni 0,0", () => {
    const { container } = render(<RatingOrNew rating={0} />);
    expect(screen.getByText("Nuevo en Oído")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.textContent).not.toContain("0,0");
  });
  it("con reseñas: cinco estrellas y la nota con coma", () => {
    const { container } = render(<RatingOrNew rating={4.5} />);
    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(5);
    expect(screen.queryByText("Nuevo en Oído")).toBeNull();
  });
});
