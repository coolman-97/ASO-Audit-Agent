# ASO Audit Agent

## A 5-minute story for an interview or Loom video

A spoken, flowing script. Read it straight through at a natural pace. The headings are
beats, not chapters; do not pause for them on camera.

---

### The setup

App Store Optimization is the SEO of mobile apps. It is what decides whether an app
gets found, downloaded, and kept. And yet, most founders and indie developers never
get a proper audit of their listing, because the tools that do it well are expensive
and the manual rubric is what consultants charge by the hour for.

I built a small chat application that closes that gap. A user pastes an Apple App Store
URL, confirms it is the app they meant, and gets back a full, evidence-cited ASO audit
in about thirty seconds. The audit scores the listing across ten weighted dimensions,
returns an overall score out of one hundred, and produces a prioritized action plan
with concrete before-and-after rewrites for every text change it suggests.

### The flow, from the user's side

Here is what that feels like for the user. They paste a URL, say, Spotify's App Store
page. The agent immediately fetches the surface metadata, the name, the developer, the
icon, the category, the rating, and shows them a card. It asks, "is this the app you
meant?", and then it stops. The audit does not run until the user says yes. That
confirmation gate is enforced in the agent's own instructions, so even if the model
got excited, it physically would not audit the wrong app.

Once the user confirms, the workflow takes over. Four things happen in parallel. The
iTunes reviews feed gives the recent rating trend and the praise and complaint themes.
The search API surfaces the top competitors in the same category. A small keyless parse
of the App Store web page recovers the subtitle and whether a preview video exists,
fields that the JSON API does not expose. And a vision model reads the actual icon and
the first screenshots, looking at the text on them, the value they communicate, and the
cohesion of the design language.

All of that gathered evidence flows into one prompt. The scoring agent reads the rubric,
scores each dimension out of ten, cites the specific data point it used, and proposes
recommendations split across quick wins, high-impact changes, and longer-term strategic
moves. The UI then renders the scorecard with animated bars, the recommendations with
before-and-after rewrites side by side, and a competitor comparison table.

### Why it is built the way it is

The reason this works cleanly is the separation Mastra gives you between agents, workflows,
tools, and skills. Each primitive does what it is good at.

The conversational agent owns the chat. It listens for a URL, calls a cheap tool, presents
the confirmation card, and waits. That is what an LLM agent is good at. It would be bad at
running a deterministic pipeline.

The workflow owns the audit. It is three typed steps: fetch, gather, score. The gather
step fans out in parallel. The workflow's wall-clock time is bounded by the slowest single
source, not the sum of all sources. Every step emits a progress event that streams back to
the chat, so the user is never staring at a blank loading bar.

The scoring agent is a separate, tool-less agent that the workflow calls when it is time
to produce the structured report. And here is a deliberate choice I am proud of. That
agent only has to return a small, forgiving JSON shape: a score, an evidence string, and
notes per dimension, plus the recommendation lists. Everything strict, the weights, the
labels, the score clamping, the overall weight-normalized score out of one hundred, is
computed in code and validated with zod schemas. Models with weaker structured-output
support break when you hand them a large strict schema. They handle a small loose one
reliably. The strict part lives in code, where it belongs.

And the rubric itself, the ten dimensions, the weights, the checks, the prompt, and the
score math, all of that lives in a single skill file. That file is the source of truth
that both agents read from. Swapping in a different framework later, say Google Play ASO
or even web SEO, would be a single-file change.

### What I am most proud of

One thing I want to call out is that the audit is honest about what it cannot see.
Apple's hundred-character keyword field is never public, so the model infers candidates
from the title, the subtitle, and the description, and it tells the user that is what it
is doing. Preview video content cannot be analyzed, only presence can be detected.
Developer responses to reviews are not in the feed. When a real source fails to load,
that gap shows up as a data note in the report. The audit never fabricates around its
blind spots, and it never silently degrades the score either.

### The closing

The whole stack is provider-agnostic. The default is NVIDIA NIM, which offers free
credits, but a one-line environment change moves the entire application to OpenAI,
Together, Groq, or a local Ollama instance. The integration tests exercise the full
workflow against real Apple endpoints and a local mock OpenAI-compatible server, so the
deterministic machinery is proven without spending provider credits to know it works.

A founder, an indie developer, or a growth marketer can now run a thirty-second audit of
any App Store listing for free. The kind of report that used to come from a paid
consultant or a subscription tool sits behind a chat box and a single paste.

It is small in surface area but serious in intent. A clean Mastra layout, honest data
handling, reliable structured output, and a UI that takes the audit seriously enough to
actually act on.
