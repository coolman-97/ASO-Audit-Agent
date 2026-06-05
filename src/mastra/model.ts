import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Provider-agnostic model configuration.
 *
 * The whole app talks to a single OpenAI-compatible endpoint, so swapping
 * providers (NVIDIA NIM → OpenAI → Together → Ollama → …) is just a matter of
 * changing `LLM_BASE_URL` + the model ids in `.env`. NVIDIA NIM is the default
 * because it offers free credits and a vision-capable model.
 *
 * Mastra agents take an `OpenAICompatibleConfig` object directly (no AI SDK
 * model instance needed), which is the idiomatic path and avoids dual-package
 * type friction. The vision helper, which calls the AI SDK's `generateText`
 * directly, builds a model instance instead.
 */

const PROVIDER_ID = "llm";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in ` +
        `(get a free key at https://build.nvidia.com).`,
    );
  }
  return value;
}

function baseURL(): string {
  return process.env.LLM_BASE_URL || "https://integrate.api.nvidia.com/v1";
}

/** Mastra model config for the reasoning / scoring agents. */
export function getAgentModel() {
  return {
    providerId: PROVIDER_ID,
    modelId: process.env.LLM_MODEL || "meta/llama-3.3-70b-instruct",
    url: baseURL(),
    apiKey: requireEnv("LLM_API_KEY"),
  };
}

/** AI SDK model instance for vision calls (`generateText` with image parts). */
export function getVisionModel(): LanguageModel {
  const provider = createOpenAICompatible({
    name: PROVIDER_ID,
    baseURL: baseURL(),
    apiKey: requireEnv("LLM_API_KEY"),
  });
  return provider(
    process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || "meta/llama-3.2-90b-vision-instruct",
  );
}
