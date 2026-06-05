"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useRef, useState, useEffect } from "react";
import type { AsoReport } from "@/mastra/schema";
import { AppConfirmCard, type AppCard } from "./AppConfirmCard";
import { ScoreCard } from "./ScoreCard";

type AnyPart = Record<string, any>;

const EXAMPLE_URL = "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580";

/** Normalize a message part into { toolName, output } for our two tools. */
function toolPart(part: AnyPart): { name: string; output: unknown; done: boolean } | null {
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return { name: part.type.slice(5), output: part.output, done: part.state === "output-available" };
  }
  if (part.type === "dynamic-tool") {
    return { name: part.toolName, output: part.output, done: part.state === "output-available" };
  }
  return null;
}

export function Console() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // The latest completed runAudit output is the report we render on the canvas.
  const report = useMemo<AsoReport | null>(() => {
    let found: AsoReport | null = null;
    for (const m of messages) {
      for (const p of (m.parts ?? []) as AnyPart[]) {
        const t = toolPart(p);
        if (t?.name === "runAudit" && t.done && t.output) found = t.output as AsoReport;
      }
    }
    return found;
  }, [messages]);

  // Most recent progress status, shown while the audit runs.
  const progress = useMemo<string | null>(() => {
    if (!busy) return null;
    let status: string | null = null;
    const last = messages[messages.length - 1];
    for (const p of (last?.parts ?? []) as AnyPart[]) {
      if (p.type === "data-audit-progress" && p.data?.status) status = p.data.status;
    }
    return status;
  }, [messages, busy]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progress]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  const empty = messages.length === 0;

  return (
    <div className="split">
      <section className="chat">
        <div className="chat__log" ref={logRef}>
          {empty && (
            <div className="msg msg--assistant">
              <span className="msg__who">Agent</span>
              <div className="bubble">
                Paste an Apple App Store link and I&apos;ll audit its App Store Optimization.
                {"\n\n"}Try:{"\n"}
                <button className="viewlink" onClick={() => setInput(EXAMPLE_URL)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  {EXAMPLE_URL}
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const parts = (m.parts ?? []) as AnyPart[];
            const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
            const card = parts
              .map(toolPart)
              .find((t) => t?.name === "lookupApp" && t?.done && t?.output)?.output as AppCard | undefined;

            return (
              <div key={m.id} className={`msg msg--${m.role}`}>
                <span className="msg__who">{m.role === "user" ? "You" : "Agent"}</span>
                {text && <div className="bubble">{text}</div>}
                {card && <AppConfirmCard app={card} />}
              </div>
            );
          })}

          {progress && (
            <div className="msg msg--assistant">
              <div className="progress">
                <span className="dot" />
                {progress}
              </div>
            </div>
          )}

          {error && (
            <div className="msg msg--assistant">
              <div className="bubble" style={{ borderColor: "var(--score-low)", color: "var(--score-low)" }}>
                {error.message || "Something went wrong. Check your server logs and .env keys."}
              </div>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste an App Store URL, or reply 'yes' to confirm…"
            aria-label="Message"
          />
          <button type="submit" disabled={busy || !input.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </form>
      </section>

      <section className="canvas">
        {report ? (
          <ScoreCard report={report} />
        ) : (
          <div className="empty">
            <div className="ring">ASO</div>
            <p>Your audit scorecard will appear here once you confirm an app and the audit runs.</p>
          </div>
        )}
      </section>
    </div>
  );
}
