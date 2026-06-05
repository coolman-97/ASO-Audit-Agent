# ASO Audit Agent

A TypeScript chat app that audits an Apple App Store listing for **App Store
Optimization (ASO)**. Paste an App Store URL, confirm it's the app you meant, and
the agent runs a comprehensive, evidence-cited audit across 10 weighted dimensions
and renders a prioritized action plan.

Built on **[Mastra](https://mastra.ai)** (agents, tools, workflows, and a reusable
skill) with a custom Next.js front end.

![flow](https://img.shields.io/badge/flow-paste%20%E2%86%92%20confirm%20%E2%86%92%20audit-f2b03d)

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in your keys (see below)
npm run dev               # http://localhost:3000
```

Paste an App Store URL into the chat, e.g.
`https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580`,
confirm the app, and watch the audit run.

### Environment

Everything is OpenAI-compatible, so any provider works by changing the base URL +
model ids. **NVIDIA NIM** is the default (free credits at
<https://build.nvidia.com>).

| Variable | Required | Purpose |
|---|---|---|
| `LLM_API_KEY` | ✅ | Key for the OpenAI-compatible endpoint. |
| `LLM_BASE_URL` | – | Defaults to `https://integrate.api.nvidia.com/v1`. |
| `LLM_MODEL` | – | Reasoning/scoring model. Default `meta/llama-3.3-70b-instruct`. **Must support tool calling.** |
| `LLM_VISION_MODEL` | – | Vision model for screenshot/icon analysis. Default `meta/llama-3.2-90b-vision-instruct`. Falls back gracefully if unavailable. |
| `FIRECRAWL_API_KEY` | – | Optional. A keyless parser already extracts the subtitle + preview-video reliably; Firecrawl is only an upgrade for promotional-text robustness. |

To use OpenAI instead, for example:

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
LLM_VISION_MODEL=gpt-4o
```

---

## How it works

```
Browser (useChat)  ──/api/chat──►  asoAuditAgent  (chat + confirmation)
                                     │  tool: lookupApp  → confirmation card
                                     │  tool: runAudit   → runs the workflow ↓
                                     ▼
                            asoAudit workflow
              fetch metadata → gather signals (parallel) → LLM scoring
                                     ▼
                            AsoReport (typed)  → rendered scorecard
```

- **Agent** (`asoAuditAgent`) owns the conversation. On a URL it calls `lookupApp`,
  shows a confirmation card, and asks *"Is this the app you meant?"* It only calls
  `runAudit` after you confirm.
- **Workflow** (`asoAudit`) is the deterministic audit pipeline: surface metadata →
  parallel signal gathering (reviews, competitors, web extras, screenshot vision) →
  LLM scoring → a typed `AsoReport`. Per-step progress is streamed to the chat.
- **Scoring agent** (`scoringAgent`) produces the structured report via Mastra's
  `structuredOutput` (with a JSON fallback for weaker models).
- **Skill** (`src/mastra/skills/aso-audit-skill.ts`) is the single source of truth
  for the rubric (weights + checks), the system prompt, and the score computation.

### Data sources (all free; no scraping required for most of it)

| Source | What it provides |
|---|---|
| iTunes **Lookup API** | name, developer, icon, category, description, "What's New", screenshots, ratings, version |
| iTunes **reviews RSS** | recent reviews (rating + text) → trend & themes |
| iTunes **Search / genre charts** | top category competitors, enriched with ratings |
| App Store **web page** (keyless parse) | subtitle + preview-video presence (promo text too, when set) |
| **Vision model** | reads the actual icon + first screenshots (OCR-able text, value, cohesion) |

The audit is **honest about what it can't see**: the 100-char keyword field is never
public (the model infers candidate keywords from the title/subtitle/description, as
real ASO practitioners do), preview-video *content* can't be analyzed (only
presence), and developer review-responses aren't in the feed. Genuine data gaps
(e.g. a page that failed to load) show up as "Data notes" rather than being
fabricated; expected findings (an app simply having no subtitle) are reported as
recommendations, not caveats.

---

## Project layout

```
src/
  app/
    page.tsx                 # split layout: chat + audit canvas
    api/chat/route.ts        # handleChatStream → useChat
  components/                # Console, AppConfirmCard, ScoreCard
  mastra/
    index.ts                 # Mastra instance (agents + workflow)
    model.ts                 # provider-agnostic model config
    schema.ts                # zod contracts (metadata → report)
    skills/aso-audit-skill.ts# the rubric + scoring (the "skill")
    agents/                  # asoAuditAgent, scoringAgent
    tools/                   # lookupApp, runAudit
    workflows/audit-workflow.ts
    services/                # pure, testable: itunes, reviews, competitors, extras, vision, score, url
```

---

## Testing

```bash
npm run typecheck            # tsc --noEmit
npm test                     # hermetic unit tests
npm run test:integration     # live tests: real Apple APIs + a mock LLM (no keys needed)
```

The integration suite verifies the whole non-LLM path against live Apple endpoints,
and verifies Mastra model resolution, structured-output scoring, and the full
`runAudit` → workflow pipeline against a mock OpenAI-compatible server — so the
deterministic machinery is proven without burning provider credits.

---

## Decisions left to me

- **Apple's free JSON API is primary, not scraping.** The iTunes Lookup + RSS +
  Search APIs cover most of the rubric reliably for any app. The three fields they
  lack (subtitle, promo text, video) come from a small keyless parse of the App
  Store web page — the subtitle and preview-video flag are extracted reliably with
  no API key; Firecrawl is an optional upgrade for promotional-text robustness.
- **Custom Next.js UI over the Mastra playground**, because the brief explicitly
  asks for the recommendations to be "actually nice to look at" — a hand-built
  scorecard (animated progress bars, before/after rewrites, competitor table) does
  that better than markdown in a generic chat.
- **Agent for conversation, workflow for the audit.** The confirmation is natural
  turn-taking (what an LLM agent is good at); the audit is deterministic
  orchestration (what a workflow is good at). The confirmation gate is
  instruction-enforced; it could be hardened with Mastra's `requireApproval` if a
  stricter, click-to-approve gate were preferred.
- **Weights are normalized.** The rubric's dimension weights sum to 110%, so the
  overall score is a weight-normalized average of the 0–10 scores scaled to 0–100 —
  a true score out of 100 regardless of the weight total.
- **Provider-agnostic via OpenAI-compatible.** One env switch moves between NIM,
  OpenAI, etc. Vision degrades gracefully so a non-vision model still produces a
  full audit.

## Limitations

- Tool-calling quality depends on the chosen model; use a tool-calling-capable model
  for the chat agent (the defaults are).
- Free-tier NIM rate limits / the 90B vision model can add latency; the audit fetches
  in parallel and completes with partial data (noted in the report) if a source fails.
