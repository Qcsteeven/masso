import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setAccessToken } from "./client";

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("api client", () => {
  afterEach(() => { vi.restoreAllMocks(); setAccessToken(null); });

  it("unwraps success envelope and sends bearer token", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond({ request_id: "r", status: "success", data: { a: 1 } }));
    setAccessToken("tok");
    const data = await api.get<{ a: number }>("/api/x", { q: "1", empty: "" });
    expect(data).toEqual({ a: 1 });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/x?q=1");
    expect(((init ?? {}).headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("throws ApiError with russian message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      respond({ request_id: "r", status: "error", error: { code: "HINT_LIMIT_EXCEEDED", message: "Лимит подсказок исчерпан." } }, 409));
    await expect(api.post("/api/sessions/1/hints", {})).rejects.toMatchObject({ code: "HINT_LIMIT_EXCEEDED", status: 409 });
  });

  it("refreshes once on 401 and retries", async () => {
    const spy = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => respond({ request_id: "r", status: "error", error: { code: "AUTH_INVALID_CREDENTIALS", message: "x" } }, 401))
      .mockImplementationOnce(() => respond({ request_id: "r", status: "success", data: { access_token: "new" } }))
      .mockImplementationOnce(() => respond({ request_id: "r", status: "success", data: 42 }));
    expect(await api.get<number>("/api/y")).toBe(42);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(((spy.mock.calls[2][1] ?? {}).headers as Record<string, string>).Authorization).toBe("Bearer new");
  });

  it("network failure becomes ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("fail")));
    await expect(api.get("/api/z")).rejects.toBeInstanceOf(ApiError);
  });
});
