import { Agent } from "@mastra/core/agent";
import { getAgentModel } from "../model";
import { AUDIT_SYSTEM_PROMPT } from "../skills/aso-audit-skill";

/**
 * A tool-less agent dedicated to producing the structured audit. It's used by
 * the scoring step via `mastra.getAgent("scoringAgent").generate(..., {
 * structuredOutput })`, which gives us Mastra's built-in JSON fallback for
 * OpenAI-compatible models with weaker structured-output support.
 */
export const scoringAgent = new Agent({
  id: "scoringAgent",
  name: "ASO Scoring Agent",
  instructions: AUDIT_SYSTEM_PROMPT,
  // Lazy so the API key is read at request time, not at import/build time.
  model: () => getAgentModel(),
});
