/**
 * Verifies that a Mastra agent resolves our OpenAICompatibleConfig (providerId +
 * modelId + url + apiKey) and issues a correctly-formed request to the endpoint.
 * Uses a local mock OpenAI-compatible server — no real provider key required.
 * Opt-in via `npm run test:integration`.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let server: Server;
let port: number;
const captured: { path?: string; auth?: string; model?: string } = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      captured.path = req.url;
      captured.auth = req.headers.authorization;
      try {
        captured.model = JSON.parse(body).model;
      } catch {
        /* ignore */
      }
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "chatcmpl-mock",
          object: "chat.completion",
          created: 0,
          model: captured.model ?? "mock",
          choices: [
            { index: 0, message: { role: "assistant", content: "Hello from mock" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;

  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "mock-key";
  process.env.LLM_MODEL = "vendor/mock-model";
});

afterAll(() => {
  server?.close();
});

describe("Mastra model resolution", () => {
  it("resolves OpenAICompatibleConfig and calls the endpoint correctly", async () => {
    const { scoringAgent } = await import("./scoring-agent");
    const res = await scoringAgent.generate("Say hello.");

    expect(res.text).toContain("Hello from mock");
    expect(captured.path).toContain("/v1/chat/completions");
    expect(captured.auth).toBe("Bearer mock-key");
    expect(captured.model).toBe("vendor/mock-model");
  }, 30_000);
});
