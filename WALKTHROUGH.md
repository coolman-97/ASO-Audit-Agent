# ASO Audit Agent — 5-minute walkthrough

A talk-track for a tech interview or Loom video. Read it straight through or use the
section headers as cue cards. Timing cues are rough — total ~5 min at a natural pace.

---

## 1 · What it is  ·  *~30s*

> *"ASO Audit Agent is a TypeScript chat app where a user pastes an Apple App Store URL,
> confirms it's the app they meant, and gets back a comprehensive, evidence-cited
> **App Store Optimization** audit — a scorecard out of 100 across 10 weighted dimensions,
> plus a prioritized list of quick wins, high-impact changes, and strategic recommendations
> with concrete **before/after** rewrites."*

The brief was deliberately open: *"show idiomatic Mastra, make it pass on apps we haven't
seen, and make the recommendations actually nice to look at."* So the project is also a
showcase of clean separation between **conversation**, **deterministic orchestration**, and
**structured AI output**.

---

## 2 · Tech stack  ·  *~45s*

| Layer | Choice | Why |
|---|---|---|
| **AI framework** | **Mastra** (agents · tools · workflows · skills) | The brief asked for it — and it cleanly separates LLM-driven turn-taking from deterministic pipelines. |
| **Web** | **Next.js 15** (App Router) + **React 19** | App Router gives us a simple streaming `/api/chat` route; React 19 + `useChat` handles the live progress chunks for free. |
| **LLM** | Any **OpenAI-compatible** endpoint — default **NVIDIA NIM** (`llama-3.3-70b` reasoning, `llama-3.2-90b-vision` for screenshots) | Free credits, vision-capable, and one env switch moves the whole app to OpenAI / Together / Groq / Ollama. |
| **Validation** | **zod** schemas end-to-end | Single source of truth from `services → workflow → LLM structured output → UI`. |
| **Data** | iTunes Lookup / Search / RSS APIs (keyless), App Store web page (keyless parse), optional Firecrawl | No scraping required for ~90% of the rubric — free and reliable. |
| **Testing** | **Vitest** — hermetic unit tests + a live integration suite (real Apple endpoints + a mock OpenAI-compatible server) | Proves the deterministic machinery without burning provider credits. |

---

## 3 · Architecture  ·  *~75s*

> *"There are three Mastra primitives at play, and each is doing exactly what it's good at:"*

- **The agent (`asoAuditAgent`)** owns the conversation. It receives the URL, calls the
  cheap **`lookupApp`** tool (no LLM, just Apple's JSON), shows a confirmation card, and
  **stops**. The confirmation gate is instruction-enforced — it physically can't audit
  before the user says "yes."
- **The workflow (`asoAudit`)** is the deterministic audit pipeline — three typed steps:
  ① fetch metadata → ② **fan out in parallel** to four sources (reviews, competitors,
  page extras, vision over screenshots) → ③ score. Wall-clock is bounded by the slowest
  single source, not their sum.
- **The scoring agent (`scoringAgent`)** is a separate, tool-less agent the workflow
  calls. It produces the structured report; weights, clamping, key canonicalization, and
  the overall score are computed **in code** (not by the model) and validated with zod.

> *"And both agents read the rubric from the same place — a **skill** file that's the
> single source of truth for weights, checks, and score math."*

A high-level picture (a fuller Mermaid version lives in the README):

```
Browser (useChat)  ──/api/chat──►  asoAuditAgent  (chat + confirmation gate)
                                     │  tool: lookupApp  → confirmation card
                                     │  tool: runAudit   → runs the workflow ↓
                                     ▼
                            asoAudit workflow
              fetch metadata → gather signals (parallel) → LLM scoring
                                     ▼
                            AsoReport (typed)  → rendered scorecard
```

> *"One subtle but deliberate choice: the LLM only has to return a small, forgiving JSON
> shape — `score`, `evidence`, `notes` per dimension and the recommendation lists. The
> strict report the UI consumes is **assembled in code**. That keeps scoring reliable
> across models with weaker structured-output support."*

---

## 4 · End-to-end workflow  ·  *~60s*

1. The user pastes a URL — say Spotify's. The agent calls `lookupApp`, which hits Apple's
   free Lookup API and returns the surface metadata: name, developer, icon, category,
   rating. The UI renders a **confirmation card**. The agent asks *"Is this the app you
   meant?"* and **waits**.
2. The user replies *"yes"*. The agent now calls `runAudit`, which kicks off the workflow.
3. The workflow streams **per-step progress** back to the chat — *"Looking up the
   listing… Reading reviews, competitors, screenshots… Scoring the listing…"* — so the
   user is never staring at a blank spinner.
4. Step 2 fans out **four parallel** calls: the **reviews RSS** for praise/complaint
   themes, **Search API** for top category competitors, a small **keyless web parse** for
   subtitle + preview-video presence, and a **vision call** over the icon + first
   screenshots.
5. Step 3 builds one **evidence-rich prompt** — actual character counts, ratings,
   themes, vision notes — and the scoring agent returns the audit. We clamp scores,
   attach canonical weights and labels, compute the weight-normalized **overall /100**,
   and return a typed `AsoReport`.
6. The UI renders the scorecard: animated dimension bars, three tiers of recommendations
   with **before/after** text, and a competitor table. A 1–2 sentence spoken summary
   from the agent rounds it off.

---

## 5 · Impact / who it's for  ·  *~30s*

> *"ASO is normally a paid-tool space — App Annie, Sensor Tower, AppTweak — and the
> manual rubric is what consultants charge for. This compresses both into a free,
> 30-second audit a founder, indie dev, or growth marketer can run on any app. Because
> the rubric and prompt live in one **skill** file, swapping in a different framework
> (Google Play ASO, web SEO) is a single-file change."*

---

## 6 · How to run it  ·  *~30s*

```bash
npm install
cp .env.example .env      # add your LLM_API_KEY (free at build.nvidia.com)
npm run dev               # http://localhost:3000
```

Tests:

```bash
npm test                  # hermetic unit tests
npm run test:integration  # live: real Apple APIs + a mock LLM
```

Provider-agnostic — to switch to OpenAI, change `LLM_BASE_URL`, `LLM_API_KEY`, and the
model ids. Nothing else moves.

---

## 7 · What I think is strong about it  ·  *~45s*

- **Right primitive for each job.** Agent for chat, workflow for the audit, skill for the
  rubric, services for pure I/O. The boundaries make every piece independently testable.
- **Lenient in, strict out.** The LLM gets a small, forgiving JSON contract; the UI gets
  a strict zod-validated report. Reliable across model tiers.
- **Honest about data gaps.** Apple's keyword field is never public, video content can't
  be analyzed, dev responses aren't in the RSS feed — the audit *says so* and infers
  rather than fabricates. Genuine source failures appear as **"Data notes"** instead of
  silently degrading the score.
- **Parallel signal gathering.** `Promise.all` on the four sources — wall-clock is the
  slowest single source, not their sum. Graceful per-source fallbacks.
- **Hand-built UI.** Animated scorecard, before/after rewrites, competitor table. The
  brief asked for it to *"actually be nice to look at,"* and a generic markdown chat
  wouldn't have cleared that bar.
- **Live integration tests with a mock LLM.** The whole `runAudit → workflow` pipeline
  is verified end-to-end against real Apple endpoints and a local mock OpenAI-compatible
  server, so we never spend provider credits to know it works.

---

## 8 · Where I'd take it next  ·  *~45s*

- **Server-side memory.** Right now `useChat` resends the full history each turn — fine
  for a single conversation, but Mastra storage would let us persist past audits and
  diff a listing over time.
- **Stricter approval gate.** The confirmation is currently instruction-enforced. For a
  production deployment I'd wrap `runAudit` with Mastra's `requireApproval` so the
  audit physically can't fire without a click.
- **Eval harness.** A small set of "golden" audits (known-good apps, known-bad apps,
  edge cases) regression-tested against any model swap, so we'd know immediately if a
  cheaper model degrades the rubric.
- **Real keyword-field inference.** Today the model infers candidates from the visible
  fields. Pairing that with category-level search-volume data (from a paid source) would
  make the keyword recommendations sharper.
- **Google Play parity.** The rubric and scoring are framework-agnostic — a second
  `services/play-store.ts` and a tweaked skill file would unlock the other half of the
  market.
- **Streaming the score, not just progress.** The scorecard could render dimension-by-
  dimension as the model produces them, instead of waiting for the full JSON.

---

## 9 · Closing line  ·  *~10s*

> *"Net-net: it's a small surface but a serious one — a clean Mastra layout, honest
> data handling, reliable structured output, and a UI that takes the audit seriously
> enough to actually act on."*
