import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server, captured } from "../test/server";
import { ApiError, updateTask, setTaskStatus } from "./client";

describe("api client", () => {
  it("updateTask wraps fields in {fields} (UpdateFieldsBody)", async () => {
    await updateTask(1, { sort_order: 5 });
    const call = captured.find((c) => c.method === "PATCH");
    expect(call?.body).toEqual({ fields: { sort_order: 5 } });
  });

  it("setTaskStatus posts {status}", async () => {
    await setTaskStatus(1, "doing");
    const call = captured.find((c) => c.url === "/api/tasks/1/status");
    expect(call?.body).toEqual({ status: "doing" });
  });

  it("maps {error} body to a typed ApiError", async () => {
    server.use(
      http.post("/api/tasks/:id/status", () =>
        HttpResponse.json({ error: "task not found: 99" }, { status: 404 })
      )
    );
    await expect(setTaskStatus(99, "doing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "task not found: 99",
    });
    expect(ApiError).toBeDefined();
  });
});
