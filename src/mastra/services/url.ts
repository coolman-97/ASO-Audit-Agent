/**
 * Parse the pieces we need out of an Apple App Store URL.
 *
 * Apple URLs look like:
 *   https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580
 *   https://apps.apple.com/gb/app/id284882215            (no slug)
 *   https://apps.apple.com/app/id284882215?mt=8          (no country)
 *   https://itunes.apple.com/us/app/foo/id12345?bar=baz  (legacy host)
 *
 * The only parts that actually matter for the iTunes APIs are the numeric track
 * id and the two-letter storefront country code (which defaults to `us`).
 */

export interface ParsedAppStoreUrl {
  /** Numeric App Store track id, e.g. "324684580". */
  appId: string;
  /** Two-letter ISO storefront country code, lower-cased. Defaults to "us". */
  country: string;
}

const DEFAULT_COUNTRY = "us";

/** Extract the `idNNN` track id from anywhere in the URL. */
function extractAppId(url: string): string | null {
  // Matches `/id324684580`, `id324684580`, and `?id=324684580` variants.
  const match = url.match(/\bid(\d{3,})\b/) ?? url.match(/[?&]id=(\d{3,})/);
  return match ? match[1] : null;
}

/** Extract the `/{cc}/` storefront segment if present. */
function extractCountry(url: string): string {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    // The country is the first path segment when present, e.g. /us/app/...
    const first = segments[0]?.toLowerCase();
    if (first && /^[a-z]{2}$/.test(first) && first !== "app") {
      return first;
    }
  } catch {
    // Not a parseable URL — fall through to the default.
  }
  return DEFAULT_COUNTRY;
}

/**
 * Parse an App Store URL into `{ appId, country }`.
 * @throws if the string is not a recognizable Apple App Store URL with a track id.
 */
export function parseAppStoreUrl(input: string): ParsedAppStoreUrl {
  const url = input.trim();

  if (!/(apps|itunes)\.apple\.com/i.test(url)) {
    throw new Error(
      "That doesn't look like an Apple App Store link. Paste a URL like " +
        "https://apps.apple.com/us/app/<name>/id000000000",
    );
  }

  const appId = extractAppId(url);
  if (!appId) {
    throw new Error(
      "Couldn't find an app id in that URL. It should contain `id` followed by digits, " +
        "e.g. .../id324684580",
    );
  }

  return { appId, country: extractCountry(url) };
}

/** Find the first App Store URL inside a free-form chat message, if any. */
export function findAppStoreUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:apps|itunes)\.apple\.com\/\S+/i);
  return match ? match[0] : null;
}
