"use client";

import { useEffect, useState } from "react";
import type { AsoReport, DimensionScore, Recommendation } from "@/mastra/schema";

const ORDER = [
  "title", "subtitle", "keywordField", "description", "screenshots",
  "appPreviewVideo", "ratingsReviews", "icon", "conversionSignals", "competitivePosition",
];

/** Per-dimension status (0-10 scale). */
function status(score: number): { label: string; color: string; bg: string } {
  if (score >= 7) return { label: "Strong", color: "var(--score-high)", bg: "rgba(79,209,165,0.14)" };
  if (score >= 4) return { label: "Fair", color: "var(--score-mid)", bg: "rgba(239,173,60,0.14)" };
  return { label: "Weak", color: "var(--score-low)", bg: "rgba(239,90,82,0.14)" };
}

function grade(overall: number): { label: string; color: string; bg: string } {
  if (overall >= 80) return { label: "Excellent", color: "#a6ead2", bg: "rgba(79,209,165,0.15)" };
  if (overall >= 65) return { label: "Good", color: "#a6ead2", bg: "rgba(79,209,165,0.12)" };
  if (overall >= 50) return { label: "Fair", color: "#f2c879", bg: "rgba(239,173,60,0.14)" };
  return { label: "Needs work", color: "#f3a9a4", bg: "rgba(239,90,82,0.13)" };
}

function Gauge({ overall }: { overall: number }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const target = C * (1 - Math.max(0, Math.min(100, overall)) / 100);
  const [offset, setOffset] = useState(C);
  useEffect(() => {
    const t = setTimeout(() => setOffset(target), 80);
    return () => clearTimeout(t);
  }, [target]);
  const color = status(overall / 10).color;
  return (
    <div className="gauge">
      <svg viewBox="0 0 150 150" width="150" height="150">
        <circle cx="75" cy="75" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        <circle
          cx="75" cy="75" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div className="gauge__num" style={{ color }}>{overall}</div>
        <div className="gauge__den">/ 100</div>
      </div>
    </div>
  );
}

function Dimension({ dim, first }: { dim: DimensionScore; first: boolean }) {
  const pct = Math.max(0, Math.min(10, dim.score)) * 10;
  const st = status(dim.score);
  return (
    <div className="dim" style={first ? { paddingTop: 0, borderTop: "none" } : undefined}>
      <div className="dim__head">
        <div className="dim__label">{dim.label}<small>{dim.weight}%</small></div>
        <div className="dim__right">
          <span className="dstatus" style={{ color: st.color, background: st.bg }}>{st.label}</span>
          <div className="dim__score" style={{ color: st.color }}><b>{dim.score}</b><span>/10</span></div>
        </div>
      </div>
      <div className="dim__track"><div className="dim__fill" style={{ width: `${pct}%`, background: st.color }} /></div>
      {dim.evidence && <div className="dim__evidence"><b>Why:</b> {dim.evidence}</div>}
    </div>
  );
}

function RecSection({ title, recs }: { title: string; recs: Recommendation[] }) {
  if (!recs?.length) return null;
  return (
    <div>
      <h3 className="section__title">{title}</h3>
      <div className="recs">
        {recs.map((r, i) => (
          <div className="rec" key={i}>
            <h4><span className="rn">{String(i + 1).padStart(2, "0")}</span>{r.title}</h4>
            {r.detail && <p>{r.detail}</p>}
            {(r.before || r.after) && (
              <div className="rec__ba">
                {r.before && <div className="before"><span className="k">Before</span><span className="val">{r.before}</span></div>}
                {r.after && <div className="after"><span className="k">After</span><span className="val">{r.after}</span></div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreCard({ report }: { report: AsoReport }) {
  const dims = [...report.dimensions].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const g = grade(report.overallScore);

  const strong = dims.filter((d) => d.score >= 7).length;
  const fair = dims.filter((d) => d.score >= 4 && d.score < 7).length;
  const weak = dims.filter((d) => d.score < 4).length;

  // Focus areas = the lowest-scoring dimensions worth fixing first.
  const focus = [...dims].sort((a, b) => a.score - b.score).filter((d) => d.score < 7).slice(0, 3);

  return (
    <div className="report">
      <div className="hero">
        <Gauge overall={report.overallScore} />
        <div className="hero__body">
          <div className="hero__app">
            {report.app.iconUrl && <img src={report.app.iconUrl} alt="" />}
            <div>
              <h1 className="hero__title">{report.app.name}</h1>
              <div className="hero__sub">
                {report.app.developer} · {report.app.primaryGenre} · {report.app.country.toUpperCase()}{" "}
                — <a className="viewlink" href={report.app.trackViewUrl} target="_blank" rel="noreferrer">App Store ↗</a>
              </div>
            </div>
          </div>
          <span className="grade" style={{ color: g.color, background: g.bg }}>● {g.label}</span>
          <p className="hero__summary">{report.summary}</p>
          <div className="glance">
            <span className="glance-chip"><span className="gd" style={{ background: "var(--score-high)" }} /><b>{strong}</b> strong</span>
            <span className="glance-chip"><span className="gd" style={{ background: "var(--score-mid)" }} /><b>{fair}</b> fair</span>
            <span className="glance-chip"><span className="gd" style={{ background: "var(--score-low)" }} /><b>{weak}</b> need work</span>
          </div>
        </div>
      </div>

      {focus.length > 0 && (
        <div>
          <h3 className="section__title">Fix These First</h3>
          <div className="focusgrid">
            {focus.map((d) => {
              const st = status(d.score);
              return (
                <div className="focuscard" key={d.key} style={{ borderLeftColor: st.color }}>
                  <div className="fl">
                    <span className="fname">{d.label}</span>
                    <span className="fscore" style={{ color: st.color }}>{d.score}/10</span>
                  </div>
                  <div className="fnote">{d.notes || d.evidence}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="section__title">Full Score Card</h3>
        <div className="panel dims">
          {dims.map((d, i) => <Dimension key={d.key} dim={d} first={i === 0} />)}
        </div>
      </div>

      <div className="cols">
        <RecSection title="Quick Wins" recs={report.quickWins} />
        <RecSection title="High-Impact Changes" recs={report.highImpact} />
      </div>

      <RecSection title="Strategic Recommendations" recs={report.strategic} />

      {report.competitorComparison?.length > 0 && (
        <div>
          <h3 className="section__title">Competitor Comparison</h3>
          <div className="panel" style={{ padding: "0.4rem 0.6rem" }}>
            <table className="ctable">
              <thead>
                <tr><th>App</th><th>Rating</th><th>Ratings</th><th>Note</th></tr>
              </thead>
              <tbody>
                {report.competitorComparison.map((c, i) => {
                  const val = parseFloat(c.rating);
                  return (
                    <tr key={i} className={i === 0 ? "self" : undefined}>
                      <td className="name">{c.name}{i === 0 && " (this app)"}</td>
                      <td>
                        <span className="rating">
                          {c.rating}
                          {!Number.isNaN(val) && val <= 5 && (
                            <span className="ratingbar"><i style={{ width: `${(val / 5) * 100}%` }} /></span>
                          )}
                        </span>
                      </td>
                      <td>{c.ratingCount}</td>
                      <td>{c.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.dataNotes?.length > 0 && (
        <div className="notes">
          <strong>Data notes &amp; assumptions</strong>
          <ul>{report.dataNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
