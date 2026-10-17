import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, tables, lists and inline marks", () => {
    const src = "# Договор\n\nЦена **100 руб.** и _срок_.\n\n| Товар | Сумма |\n|---|---|\n| Бумага | 10 |\n\n- пункт 1\n- пункт 2";
    const { container } = render(<Markdown source={src} />);
    expect(screen.getByRole("heading", { name: "Договор" })).toBeInTheDocument();
    expect(container.querySelector("strong")?.textContent).toBe("100 руб.");
    expect(container.querySelector("em")?.textContent).toBe("срок");
    expect(screen.getByRole("cell", { name: "Бумага" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("does not inject HTML", () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)"> текст'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img");
  });
});
