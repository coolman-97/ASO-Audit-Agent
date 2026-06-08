import type { AppMetadata, Competitor } from "../schema";
import { fetchJson } from "./http";
import { lookupManyByIds } from "./itunes";

interface TopAppEntry {
  id?: { attributes?: { "im:id"?: string } };
}
interface TopAppFeed {
  feed?: { entry?: TopAppEntry[] };
}

interface SearchResult {
  trackId: number;
}
interface SearchResponse {
  results: SearchResult[];
}

const MAX_COMPETITORS = 3;

/** Map enriched metadata into the lean Competitor shape. */
function toCompetitor(app: AppMetadata): Competitor {
  return {
    name: app.name,
    developer: app.developer,
    averageUserRating: app.averageUserRating ?? null,
    userRatingCount: app.userRatingCount ?? null,
    // Apple's JSON API has no subtitle; use the first line of the description as a proxy.
    subtitleOrTagline: app.description ? app.description.split("\n")[0].slice(0, 80) : null,
  };
}

/** Get the top-ranked free app ids in a genre (true category competitors). */
async function topAppIdsByGenre(genreId: string, country: string): Promise<string[]> {
  const data = await fetchJson<TopAppFeed>(
    `https://itunes.apple.com/${encodeURIComponent(country)}/rss/topfreeapplications/limit=10/genre=${encodeURIComponent(genreId)}/json`,
  );
  return (data.feed?.entry ?? [])
    .map((e) => e.id?.attributes?.["im:id"])
    .filter((id): id is string => Boolean(id));
}

/** Fallback: search the store using the genre name as a term. */
async function searchAppIdsByTerm(term: string, country: string): Promise<string[]> {
  const data = await fetchJson<SearchResponse>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}&entity=software&limit=10`,
  );
  return (data.results ?? []).map((r) => String(r.trackId));
}

/**
 * Find up to 3 competitors in the same category and enrich them with ratings.
 * Prefers the genre top-charts; falls back to a keyword search. Never throws -
 * an empty list just means the competitive-position dimension is scored softly.
 */
export async function findCompetitors(app: AppMetadata): Promise<Competitor[]> {
  try {
    let ids: string[] = [];
    if (app.primaryGenreId) {
      ids = await topAppIdsByGenre(app.primaryGenreId, app.country).catch(() => []);
    }
    if (ids.length === 0) {
      ids = await searchAppIdsByTerm(app.primaryGenre, app.country).catch(() => []);
    }

    const competitorIds = ids
      .filter((id) => id !== app.appId)
      .slice(0, MAX_COMPETITORS + 2); // grab a couple extra in case some fail to enrich
    if (competitorIds.length === 0) return [];

    const enriched = await lookupManyByIds(competitorIds, app.country);
    return enriched
      .filter((c) => c.appId !== app.appId)
      .slice(0, MAX_COMPETITORS)
      .map(toCompetitor);
  } catch {
    return [];
  }
}
