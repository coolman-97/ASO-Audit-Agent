/**
 * Server runtime tuning. Imported (for its side effect) before the Mastra
 * instance is created.
 *
 * NVIDIA NIM's free tier can take a long time to send the first response byte
 * (cold starts / queueing), and large requests — e.g. the agent's final turn
 * carrying the full audit report — exceed Node's default undici headers timeout,
 * surfacing as `UND_ERR_HEADERS_TIMEOUT`. We raise the header/body timeouts and
 * keep pooled connections fresh so a stale keep-alive socket can't stall a call.
 *
 * Setting undici's global dispatcher affects Node's built-in `fetch`, so this
 * covers every LLM call (agent, scoring, vision) without per-client wiring.
 */
import { Agent, setGlobalDispatcher } from "undici";

const TEN_MINUTES = 10 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __asoDispatcherConfigured: boolean | undefined;
}

if (!globalThis.__asoDispatcherConfigured) {
  try {
    setGlobalDispatcher(
      new Agent({
        headersTimeout: TEN_MINUTES, // time to first byte (default 300s is too low for NIM)
        bodyTimeout: TEN_MINUTES, // time between body chunks while streaming
        connect: { timeout: 30_000 },
        keepAliveTimeout: 10_000, // recycle idle sockets so a stale one can't stall
        keepAliveMaxTimeout: 10_000,
      }),
    );
    globalThis.__asoDispatcherConfigured = true;
  } catch {
    // If undici isn't available for any reason, fall back to Node defaults.
  }
}
