import type { ReviewSummary } from "../schema";
import { fetchJson } from "./http";

/** Shape of a single entry in the iTunes customer-reviews RSS-as-JSON feed. */
interface RssReviewEntry {
  "im:rating"?: { label: string };
  title?: { label: string };
  content?: { label: string };
}
interface RssReviewFeed {
  feed?: { entry?: RssReviewEntry[] };
}

function truncate(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/**
 * Fetch recent reviews from the public iTunes RSS feed and reduce them to a
 * compact summary. Theme extraction is intentionally left to the scoring LLM -
 * here we only provide a balanced, truncated sample of excerpts + the recent
 * average so the model reasons over real data rather than guesses.
 */
export async function fetchReviewSummary(
  appId: string,
  country: string,
): Promise<ReviewSummary> {
  const empty: ReviewSummary = {
    sampleSize: 0,
    averageOfRecent: null,
    praiseThemes: [],
    complaintThemes: [],
    excerpts: [],
    available: false,
  };

  try {
    const data = await fetchJson<RssReviewFeed>(
      `https://itunes.apple.com/${encodeURIComponent(country)}/rss/customerreviews/id=${encodeURIComponent(appId)}/sortBy=mostRecent/json`,
    );
    const entries = (data.feed?.entry ?? []).filter((e) => e["im:rating"]?.label);
    if (entries.length === 0) return empty;

    const reviews = entries.map((e) => ({
      rating: Number(e["im:rating"]!.label) || 0,
      title: e.title?.label ?? "",
      text: truncate(e.content?.label ?? ""),
    }));

    const averageOfRecent =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    // Balanced excerpt sample: a few of the most positive and most critical.
    const positive = reviews.filter((r) => r.rating >= 4).slice(0, 6);
    const critical = reviews.filter((r) => r.rating <= 3).slice(0, 6);
    const excerpts = [...critical, ...positive];

    return {
      sampleSize: reviews.length,
      averageOfRecent: Math.round(averageOfRecent * 100) / 100,
      praiseThemes: [],
      complaintThemes: [],
      excerpts: excerpts.length > 0 ? excerpts : reviews.slice(0, 8),
      available: true,
    };
  } catch {
    return empty;
  }
}
