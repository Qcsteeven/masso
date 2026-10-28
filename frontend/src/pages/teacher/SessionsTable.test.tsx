import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { GroupOverview } from "../../api/types";
import { SessionsTable } from "./Group";

const row = {
  session_id: "s-1", student: "Демонов Лев Алексеевич", student_id: "u-1", group: "ИСИб-23-1", title: "Сверка первичных документов поставщика",
  domain: "economics", finished_at: "2026-10-28T08:00:00Z", auto_score: 70, expert_score: 70, review_status: "confirmed",
} as unknown as GroupOverview["sessions"][number];

function TraceStub() {
  return <p>след {useParams().sessionId}</p>;
}

function renderTable() {
  render(
    <MemoryRouter initialEntries={["/teacher"]}>
      <Routes>
        <Route path="/teacher" element={<SessionsTable sessions={[row]} />} />
        <Route path="/teacher/sessions/:sessionId" element={<TraceStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("SessionsTable", () => {
  it("opens the trace by a click anywhere in the row", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("cell", { name: "Сверка первичных документов поставщика" }));
    expect(screen.getByText("след s-1")).toBeInTheDocument();
  });

  it("keeps a keyboard-reachable «Открыть» link", async () => {
    renderTable();
    const link = screen.getByRole("link", { name: "Открыть цифровой след: Демонов Лев Алексеевич" });
    expect(link).toHaveTextContent("Открыть");
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("след s-1")).toBeInTheDocument();
  });
});
