import type { AsoReport, DimensionScore, Recommendation } from "@/mastra/schema";

const ORDER = [
  "title",
  "subtitle",
  "keywordField",
  "description",
  "screenshots",
  "appPreviewVideo",
  "ratingsReviews",
  "icon",
  "conversionSignals",
  "competitivePosition",
];

/** 0-10 → color on the red→amber→green scale. */
function scoreColor(score10: number): string {
  if (score10 < 4) return "var(--score-low)";
  if (score10 < 7) return "var(--score-mid)";
  return "var(--score-high)";
}

function Gauge({ overall }: { overall: number }) {
  const color = scoreColor(overall / 10);
  const deg = Math.round((overall / 100) * 360);
  return (
    <div
      className="hero__gauge"
      style={{ background: `conic-gradient(${color} ${deg}deg, var(--surface-3) ${deg}deg)` }}
    >
      <div
        style={{
          position: "absolute",
          inset: 9,
          borderRadius: "50%",
          background: "var(--surface)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="num" style={{ color }}>
            {overall}
          </div>
          <div className="den">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function Dimension({ dim }: { dim: DimensionScore }) {
  const pct = Math.max(0, Math.min(10, dim.score)) * 10;
  const color = scoreColor(dim.score);
  return (
    <>
      <div className="dim">
        <div className="dim__label">
          {dim.label}
          <small>{dim.weight}% weight</small>
        </div>
        <div className="dim__track">
          <div className="dim__fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="dim__score" style={{ color }}>
          {dim.score}
        </div>
      </div>
      {dim.evidence && (
        <div className="dim__evidence">
          <b>Why:</b> {dim.evidence}
        </div>
      )}
    </>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rec">
      <h4>{rec.title}</h4>
      <p>{rec.detail}</p>
      {(rec.before || rec.after) && (
        <div className="rec__ba">
          {rec.before && (
            <div className="before">
              <span className="k">Before</span>
              <span className="val">{rec.before}</span>
            </div>
          )}
          {rec.after && (
            <div className="after">
              <span className="k">After</span>
              <span className="val">{rec.after}</span>
            </div>
          )}
        </div>
      )}
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
          <RecCard key={i} rec={r} />
        ))}
      </div>
    </div>
  );
}

export function ScoreCard({ report }: { report: AsoReport }) {
  const dims = [...report.dimensions].sort(
    (a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key),
  );

  return (
    <div className="report">
      <div className="hero">
        <Gauge overall={report.overallScore} />
        <div className="hero__body">
          <h1>{report.app.name}</h1>
          <div className="sub">
            {report.app.developer} · {report.app.primaryGenre} · {report.app.country.toUpperCase()} —{" "}
            <a className="viewlink" href={report.app.trackViewUrl} target="_blank" rel="noreferrer">
              view on App Store ↗
            </a>
          </div>
          <p className="summary">{report.summary}</p>
        </div>
      </div>

      <div>
        <h3 className="section__title">ASO Score Card</h3>
        <div className="dims">
          {dims.map((d) => (
            <Dimension key={d.key} dim={d} />
          ))}
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
          <table className="ctable">
            <thead>
              <tr>
                <th>App</th>
                <th>Rating</th>
                <th>Ratings</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {report.competitorComparison.map((c, i) => (
                <tr key={i} className={i === 0 ? "self" : undefined}>
                  <td className="name">{c.name}</td>
                  <td>{c.rating}</td>
                  <td>{c.ratingCount}</td>
                  <td>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.dataNotes?.length > 0 && (
        <div className="notes">
          <strong>Data notes &amp; assumptions</strong>
          <ul>
            {report.dataNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
