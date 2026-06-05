import type { DimensionKey } from "../schema";

/**
 * The ASO audit "skill": the rubric, the scoring rules, and the prompt builders,
 * all in one place. Adapted from the open-source aso-skills project. This is the
 * single source of truth for how the listing is judged — the scoring step and the
 * agent's instructions both read from here.
 */

export interface DimensionDef {
  key: DimensionKey;
  label: string;
  /** Percentage weight from the rubric. */
  weight: number;
  /** The concrete checks the model must reason about for this dimension. */
  checks: string;
}

export const DIMENSIONS: DimensionDef[] = [
  {
    key: "title",
    label: "Title",
    weight: 20,
    checks:
      "30-char limit. Primary keyword present? Character utilization? Brand vs. keyword " +
      "balance? Natural reading, not stuffed?",
  },
  {
    key: "subtitle",
    label: "Subtitle",
    weight: 15,
    checks:
      "30-char limit. Distinct secondary keywords (not repeating the title)? Benefit-driven? " +
      "Full character utilization?",
  },
  {
    key: "keywordField",
    label: "Keyword Field",
    weight: 15,
    checks:
      "100-char iOS keyword field. NOTE: this field is never public, so infer from the title/" +
      "subtitle/description and say so. No duplicates with title/subtitle? Singular forms? No " +
      "spaces after commas? No wasted words ('app', category names, brand)? Full 100 chars used?",
  },
  {
    key: "description",
    label: "Description",
    weight: 10,
    checks:
      "First 3 lines hook above the 'more' cutoff? Features benefit-framed? Social proof? Clear " +
      "CTA? Natural keyword integration?",
  },
  {
    key: "screenshots",
    label: "Screenshots",
    weight: 15,
    checks:
      "All 10 slots used? First 2-3 communicate value? Readable on-image text (Apple OCR-indexes " +
      "it)? Cohesive design language?",
  },
  {
    key: "appPreviewVideo",
    label: "App Preview Video",
    weight: 5,
    checks:
      "Exists? (We can detect presence but not analyze content.) A hook in the first 3 seconds, " +
      "15-30 seconds long, and works without sound are best practices to recommend.",
  },
  {
    key: "ratingsReviews",
    label: "Ratings & Reviews",
    weight: 15,
    checks:
      "Average rating? Recent trend (compare lifetime avg vs. recent sample)? Themes in praise " +
      "and complaints (derive from the excerpts)? (Developer responses aren't in our data.)",
  },
  {
    key: "icon",
    label: "Icon",
    weight: 5,
    checks:
      "Distinctive in search results? Clear at small sizes? Category-appropriate? Avoids " +
      "unreadable text?",
  },
  {
    key: "conversionSignals",
    label: "Conversion Signals",
    weight: 5,
    checks:
      "Promotional text used? 'What's New' (release notes) informative? In-App Events / custom " +
      "product pages (not directly observable — recommend if absent).",
  },
  {
    key: "competitivePosition",
    label: "Competitive Position",
    weight: 5,
    checks:
      "Keyword coverage vs. top 3 category competitors? Visual style? Rating gap (compare rating " +
      "and rating count to the competitors provided)?",
  },
];

const TOTAL_WEIGHT = DIMENSIONS.reduce((sum, d) => sum + d.weight, 0); // 110

/**
 * The rubric weights sum to 110%, so we compute the overall score as a
 * weight-normalized average of the 0-10 dimension scores, scaled to 0-100.
 * This keeps the score a true 0-100 regardless of the weight total.
 */
export function computeOverallScore(
  dimensions: { score: number; weight: number }[],
): number {
  if (dimensions.length === 0) return 0;
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0) || TOTAL_WEIGHT;
  return Math.round((weightedSum / totalWeight) * 10);
}

export const AUDIT_SYSTEM_PROMPT = [
  "You are an expert in App Store Optimization with deep knowledge of Apple's ranking",
  "algorithms. Perform a comprehensive ASO health audit and produce a prioritized action plan.",
  "",
  "Rules:",
  "- Score every dimension 0-10 using the checks provided. Use the EXACT dimension keys given.",
  "- Cite specific evidence (the actual data point) for every score and recommendation.",
  "- For any text change (title, subtitle, keyword field, description, captions) give concrete",
  "  before/after examples. 'Rewrite the title from X to Y because Z' beats 'improve the title'.",
  "- Respect Apple's character limits (title 30, subtitle 30, keyword field 100) in your rewrites.",
  "- NEVER invent data. If something wasn't provided (e.g. the subtitle, keyword field, or video),",
  "  say it was not observed and reason from what you do have. Honesty over fabrication.",
  "- Quick Wins: 3-5 high-impact changes doable today. High-Impact: 3-5 needing more effort.",
  "  Strategic: 3-5 longer-term. Keep recommendations specific and tied to evidence.",
].join("\n");

/** Compact reference of the dimensions + weights, injected into prompts. */
export function dimensionRubricText(): string {
  return DIMENSIONS.map(
    (d) => `- ${d.key} ("${d.label}", weight ${d.weight}%): ${d.checks}`,
  ).join("\n");
}
