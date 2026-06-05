import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { mastra } from "@/mastra";

// The audit calls several upstreams + an LLM; give it room.
export const maxDuration = 120;

/**
 * Chat endpoint. Streams the ASO agent's response (text, tool calls, and our
 * custom `data-audit-progress` chunks) back to the `useChat` client.
 */
export async function POST(req: Request) {
  const params = await req.json();
  try {
    // No server-side memory needed: useChat resends the full message history
    // each turn, so the agent always has the prior confirmation context.
    const stream = await handleChatStream({
      mastra,
      agentId: "asoAuditAgent",
      version: "v6",
      params,
    });
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
