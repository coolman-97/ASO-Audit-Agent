"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AsoReport } from "@/mastra/schema";
import { AppConfirmCard, type AppCard } from "./AppConfirmCard";
import { ScoreCard } from "./ScoreCard";

type AnyPart = Record<string, any>;

const EXAMPLES = [
  { emoji: "🎧", name: "Spotify", note: "Music", url: "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580" },
  { emoji: "🦉", name: "Duolingo", note: "Education", url: "https://apps.apple.com/us/app/duolingo-language-lessons/id570060128" },
  { emoji: "📝", name: "Notion", note: "Productivity", url: "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281" },
];

const AUDIT_STEPS = ["Fetching the listing", "Gathering signals", "Scoring & writing report"];

function toolPart(part: AnyPart): { name: string; output: unknown; done: boolean } | null {
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return { name: part.type.slice(5), output: part.output, done: part.state === "output-available" };
  }
  if (part.type === "dynamic-tool") return { name: part.toolName, output: part.output, done: part.state === "output-available" };
  return null;
}

function statusToStep(status: string | null): number {
  if (!status) return 0;
  if (/scor/i.test(status)) return 2;
  if (/reading|gather/i.test(status)) return 1;
  return 0;
}

export function Console() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const report = useMemo<AsoReport | null>(() => {
    let found: AsoReport | null = null;
    for (const m of messages) for (const p of (m.parts ?? []) as AnyPart[]) {
      const t = toolPart(p);
      if (t?.name === "runAudit" && t.done && t.output) found = t.output as AsoReport;
    }
    return found;
  }, [messages]);

  const auditing = useMemo(() => {
    // True once runAudit has been requested but no report yet.
    for (const m of messages) for (const p of (m.parts ?? []) as AnyPart[]) {
      const t = toolPart(p);
      if (t?.name === "runAudit" && !t.done) return true;
    }
    return busy && Boolean(report) === false && messages.some((m) =>
      (m.parts ?? []).some((p: AnyPart) => p.type === "data-audit-progress"));
  }, [messages, busy, report]);

  const progressStatus = useMemo<string | null>(() => {
    let s: string | null = null;
    const last = messages[messages.length - 1];
    for (const p of (last?.parts ?? []) as AnyPart[]) if (p.type === "data-audit-progress" && p.data?.status) s = p.data.status;
    return s;
  }, [messages]);

  // Index of the latest message bearing a lookupApp card (for the action buttons).
  const lastCardIdx = useMemo(() => {
    let idx = -1;
    messages.forEach((m, i) => {
      if ((m.parts ?? []).some((p: AnyPart) => toolPart(p)?.name === "lookupApp" && toolPart(p)?.done)) idx = i;
    });
    return idx;
  }, [messages]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progressStatus]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const currentStep = auditing ? statusToStep(progressStatus) : -1;
  const empty = messages.length === 0;

  return (
    <div className="split">
      <section className="chat">
        <div className="chat__log" ref={logRef}>
          {empty && (
            <div className="msg">
              <div className="avatar avatar--bot">A</div>
              <div className="msg__body" style={{ maxWidth: "100%" }}>
                <div className="intro">
                  <div className="intro__lead">
                    Paste an App Store link and get a <em>prioritized ASO audit</em> in a couple of minutes.
                  </div>
                  <div className="steps3">
                    <div className="step3"><b>1</b> You paste an Apple App Store URL</div>
                    <div className="step3"><b>2</b> I confirm the right app with you</div>
                    <div className="step3"><b>3</b> I run the full audit and score it /100</div>
                  </div>
                  <div className="examples__label">Try one</div>
                  {EXAMPLES.map((e) => (
                    <button key={e.url} className="example" onClick={() => send(`Audit ${e.url}`)} disabled={busy}>
                      <span className="em">{e.emoji}</span>
                      <span>
                        <span className="et">{e.name}</span> <span className="es">· {e.note}</span>
                      </span>
                      <span className="ego">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const parts = (m.parts ?? []) as AnyPart[];
            const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
            const card = parts.map(toolPart).find((t) => t?.name === "lookupApp" && t?.done && t?.output)?.output as AppCard | undefined;
            const actionable = card != null && i === lastCardIdx && !report && !busy;
            if (!text && !card) return null;
            return (
              <div key={m.id} className={`msg msg--${m.role}`}>
                <div className={`avatar avatar--${m.role === "user" ? "user" : "bot"}`}>{m.role === "user" ? "You" : "A"}</div>
                <div className="msg__body">
                  {text && <div className="bubble">{text}</div>}
                  {card && (
                    <AppConfirmCard
                      app={card}
                      actionable={actionable}
                      onConfirm={() => send("Yes, run the full audit.")}
                      onReject={() => send("No, that's not the right app - let me paste a different link.")}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {auditing && (
            <div className="msg">
              <div className="avatar avatar--bot">A</div>
              <div className="msg__body">
                <div className="progress">
                  <div className="progress__title"><span className="spinner" /> Running ASO audit</div>
                  {AUDIT_STEPS.map((label, i) => {
                    const state = i < currentStep ? "done" : i === currentStep ? "active" : "";
                    return (
                      <div key={label} className={`pstep ${state}`}>
                        <span className="pdot">{i < currentStep ? "✓" : ""}</span>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="msg">
              <div className="avatar avatar--bot">A</div>
              <div className="msg__body">
                <div className="bubble bubble--error">
                  {error.message || "Something went wrong. Check the server logs and your .env keys."}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="composer">
          <div className="composer__row">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={onKeyDown}
              placeholder="Paste an App Store URL…"
              aria-label="Message"
            />
            <button className="sendbtn" onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">
              {busy ? <span className="spinner" /> : "↑"}
            </button>
          </div>
          <div className="composer__hint">Enter to send · Shift+Enter for a new line</div>
        </div>
      </section>

      <section className="canvas">
        {report ? (
          <ScoreCard report={report} />
        ) : (
          <div className="empty">
            <div className="empty__ring">
              <svg viewBox="0 0 116 116" width="116" height="116">
                <circle cx="58" cy="58" r="54" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 7" />
              </svg>
              <span>ASO</span>
            </div>
            <h2>Your scorecard will appear here</h2>
            <p>Paste an App Store link in the chat, confirm the app, and the full audit renders right here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
