import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton from "./Skeleton";

describe("Skeleton", () => {
  it("se marca con data-skeleton (la dirección suave le da su tono sólo a él) y sigue siendo decorativo", () => {
    const { container } = render(<Skeleton className="h-4" />);
    const el = container.firstElementChild!;
    expect(el.hasAttribute("data-skeleton")).toBe(true);
    expect(el.classList.contains("animate-pulse")).toBe(true);
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
});
