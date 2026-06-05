import type { AppMetadata } from "../schema";
import { fetchJson } from "./http";
import { parseAppStoreUrl } from "./url";

/** Subset of the iTunes Lookup API response we care about. */
interface ItunesResult {
  trackId: number;
  trackName: string;
  sellerName?: string;
  artistName?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  primaryGenreId?: number;
  genres?: string[];
  description?: string;
  releaseNotes?: string;
  version?: string;
  currentVersionReleaseDate?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  contentAdvisoryRating?: string;
  price?: number;
  formattedPrice?: string;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  trackViewUrl?: string;
}

interface ItunesLookupResponse {
  resultCount: number;
  results: ItunesResult[];
}

const LOOKUP_ENDPOINT = "https://itunes.apple.com/lookup";

function mapResult(r: ItunesResult, country: string): AppMetadata {
  return {
    appId: String(r.trackId),
    country,
    name: r.trackName,
    developer: r.sellerName || r.artistName || "Unknown developer",
    iconUrl: r.artworkUrl512 || r.artworkUrl100 || "",
    primaryGenre: r.primaryGenreName || "Unknown",
    genres: r.genres ?? [],
    primaryGenreId: r.primaryGenreId != null ? String(r.primaryGenreId) : undefined,
    description: r.description ?? "",
    releaseNotes: r.releaseNotes,
    version: r.version,
    currentVersionReleaseDate: r.currentVersionReleaseDate,
    averageUserRating: r.averageUserRating,
    userRatingCount: r.userRatingCount,
    contentRating: r.contentAdvisoryRating,
    price: r.price,
    formattedPrice: r.formattedPrice,
    screenshotUrls: r.screenshotUrls ?? [],
    ipadScreenshotUrls: r.ipadScreenshotUrls ?? [],
    trackViewUrl:
      r.trackViewUrl ?? `https://apps.apple.com/${country}/app/id${r.trackId}`,
  };
}

/** Look up surface metadata for an App Store URL. */
export async function lookupAppByUrl(url: string): Promise<AppMetadata> {
  const { appId, country } = parseAppStoreUrl(url);
  return lookupAppById(appId, country);
}

/** Look up surface metadata by numeric app id + storefront country. */
export async function lookupAppById(appId: string, country: string): Promise<AppMetadata> {
  const data = await fetchJson<ItunesLookupResponse>(
    `${LOOKUP_ENDPOINT}?id=${encodeURIComponent(appId)}&country=${encodeURIComponent(country)}&entity=software`,
  );
  const result = data.results?.find((r) => r.trackId != null);
  if (!result) {
    throw new Error(
      `No App Store app found for id ${appId} in the "${country}" storefront. ` +
        `Double-check the URL and country.`,
    );
  }
  return mapResult(result, country);
}

/** Batch-lookup several app ids at once (used to enrich competitors). */
export async function lookupManyByIds(
  ids: string[],
  country: string,
): Promise<AppMetadata[]> {
  if (ids.length === 0) return [];
  const data = await fetchJson<ItunesLookupResponse>(
    `${LOOKUP_ENDPOINT}?id=${ids.join(",")}&country=${encodeURIComponent(country)}&entity=software`,
  );
  return (data.results ?? [])
    .filter((r) => r.trackId != null)
    .map((r) => mapResult(r, country));
}
