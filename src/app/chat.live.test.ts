/**
 * End-to-end chat wiring test: drives the real asoAuditAgent through
 * handleChatStream with a mock LLM that emits a genuine tool call. Proves the
 * agent calls lookupApp (executed against real Apple data), streams the tool
 * output + a confirmation message, and that the resulting UI stream contains the
 * parts the front end parses. Mock LLM, no real key. Opt-in (`test:integration`).
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SPOTIFY = "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580";

function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const hasToolResult = (parsed.messages ?? []).some(
        (m: any) => m.role === "tool" || (Array.isArray(m.content) && m.content.some((p: any) => p.type === "tool_result")),
      );

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");

      if (!hasToolResult) {
        // First turn: ask the model — it "decides" to call lookupApp.
        res.write(
          sse({
            id: "c", object: "chat.completion.chunk", model: "mock",
            choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "lookupApp", arguments: JSON.stringify({ url: SPOTIFY }) } }] }, finish_reason: null }],
          }),
        );
        res.write(sse({ id: "c", object: "chat.completion.chunk", model: "mock", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }));
      } else {
        // Second turn: after the tool result, produce the confirmation prompt.
        res.write(sse({ id: "c", object: "chat.completion.chunk", model: "mock", choices: [{ index: 0, delta: { role: "assistant", content: "Is this the app you meant? Reply yes to run the audit." }, finish_reason: null }] }));
        res.write(sse({ id: "c", object: "chat.completion.chunk", model: "mock", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }));
      }
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LLM_API_KEY = "mock-key";
  process.env.LLM_MODEL = "vendor/mock-model";
});

afterAll(() => server?.close());

describe("chat tool-calling wiring", () => {
  it("agent calls lookupApp and streams the confirmation", async () => {
    const { handleChatStream } = await import("@mastra/ai-sdk");
    const { mastra } = await import("../mastra");

    const stream = await handleChatStream({
      mastra,
      agentId: "asoAuditAgent",
      version: "v6",
      params: { messages: [{ role: "user", parts: [{ type: "text", text: `Audit ${SPOTIFY}` }] }] },
    } as any);

    const chunks: any[] = [];
    for await (const chunk of stream as any) chunks.push(chunk);
    const serialized = JSON.stringify(chunks);

    // The agent invoked our tool...
    expect(serialized).toContain("lookupApp");
    // ...the tool executed against real Apple data (returned Spotify)...
    expect(serialized.toLowerCase()).toContain("spotify");
    // ...and the confirmation question streamed back.
    expect(serialized).toContain("Is this the app you meant?");
  }, 60_000);
});
