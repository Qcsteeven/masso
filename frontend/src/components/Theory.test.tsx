import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkillNode } from "../api/types";
import { TheoryList } from "./Theory";

afterEach(cleanup);

const skill = (code: string, theory: string): SkillNode => ({
  id: code, code, domain_code: "devops", name: `Навык ${code}`, description: "", theory, level_max: 5, status: "active", dependents: 0,
});

describe("TheoryList", () => {
  it("renders one collapsible block per skill with Markdown inside", () => {
    const { container } = render(<TheoryList skills={[skill("A", "#### Порты\n\nКоманда `ss -ltnp`."), skill("B", "- пункт")]} openFirst />);
    expect(screen.getByText("Навык A")).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(container.querySelector("details")?.open).toBe(true);
    expect(container.querySelectorAll("details")[1].open).toBe(false);
    expect(container.querySelector("code")?.textContent).toBe("ss -ltnp");
  });
});
