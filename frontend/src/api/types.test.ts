import { describe, expect, it } from "vitest";
import { ENGINE_LABEL, KIND_LABEL } from "./types";

describe("scenario kind labels", () => {
  it("names every engine, including code tasks", () => {
    for (const kind of ["container", "document", "code"]) {
      expect(KIND_LABEL[kind]).toBeTruthy();
      expect(ENGINE_LABEL[kind]).toBeTruthy();
    }
    expect(ENGINE_LABEL.code).not.toBe(ENGINE_LABEL.document);
  });
});
