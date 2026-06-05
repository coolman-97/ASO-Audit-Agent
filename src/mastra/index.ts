import "./runtime"; // tune undici timeouts before any LLM fetch happens
import { Mastra } from "@mastra/core";
import { asoAuditAgent } from "./agents/aso-audit-agent";
import { scoringAgent } from "./agents/scoring-agent";
import { auditWorkflow } from "./workflows/audit-workflow";

/**
 * Central Mastra instance. Registers the conversational agent, the structured
 * scoring agent, and the audit workflow so they share storage/logging and can
 * resolve each other (the workflow's score step calls `getAgent("scoringAgent")`,
 * the chat tool calls `getWorkflow("asoAudit")`).
 */
export const mastra = new Mastra({
  agents: { asoAuditAgent, scoringAgent },
  workflows: { asoAudit: auditWorkflow },
});
