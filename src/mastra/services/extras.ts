import { Firecrawl } from "@mendable/firecrawl-js";
import { z } from "zod";
import type { AppExtras, AppMetadata } from "../schema";
import { fetchWithTimeout } from "./http";

/**
 * The subtitle, promotional text, and app-preview-video flag are NOT in Apple's
 * public JSON API — they only live on the App Store web page. We extract them
 * with a keyless HTML parse (reliable for the subtitle + video across arbitrary
 * listings) and optionally upgrade to Firecrawl when a key is present.
 */

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Keyless parse of the App Store web page. */
async function viaHtml(url: string): Promise<AppExtras> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 12_000);
    if (!res.ok) throw new Error(`page ${res.status}`);
    const html = await res.text();

    // The product-header subtitle, e.g. <p class="subtitle svelte-xxx">Songs & Playlists For You</p>
    const subMatch = html.match(
      /<(?:h1|h2|p)[^>]*class="[^"]*\bsubtitle\b[^"]*"[^>]*>([^<]{1,90})</i,
    );
    const subtitle = subMatch ? decodeEntities(subMatch[1].trim()) || null : null;

    // Promotional text, when present, is embedded in the serialized page JSON.
    const promoMatch = html.match(/"promotionalText":"((?:[^"\\]|\\.)*)"/);
    let promotionalText: string | null = null;
    if (promoMatch) {
      try {
        promotionalText = JSON.parse(`"${promoMatch[1]}"`) || null;
      } catch {
        promotionalText = null;
      }
    }

    // A preview video is present iff the page references an mp4/m3u8 asset.
    const hasAppPreviewVideo = /https:\/\/[^"']+\.(?:mp4|m3u8)/i.test(html);

    return { subtitle, promotionalText, hasAppPreviewVideo, source: "html-parse" };
  } catch {
    return { subtitle: null, promotionalText: null, hasAppPreviewVideo: null, source: "unavailable" };
  }
}

const firecrawlSchema = z.object({
  subtitle: z.string().nullable(),
  promotionalText: z.string().nullable(),
  hasAppPreviewVideo: z.boolean(),
});

/** Optional upgrade: Firecrawl's LLM extraction (used only if a key is set). */
async function viaFirecrawl(url: string, apiKey: string): Promise<AppExtras> {
  const firecrawl = new Firecrawl({ apiKey });
  const result = await firecrawl.scrape(url, {
    formats: [
      {
        type: "json",
        schema: firecrawlSchema,
        prompt:
          "Extract the app's subtitle (the short tagline under the app name, max ~30 chars — NOT " +
          "the description), the promotional text if present, and whether an app preview video exists.",
      },
    ],
    onlyMainContent: false,
  });
  const json = (result as { json?: z.infer<typeof firecrawlSchema> }).json;
  return {
    subtitle: json?.subtitle ?? null,
    promotionalText: json?.promotionalText ?? null,
    hasAppPreviewVideo: json?.hasAppPreviewVideo ?? null,
    source: "firecrawl",
  };
}

export async function fetchAppExtras(app: AppMetadata): Promise<AppExtras> {
  const url = app.trackViewUrl;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    try {
      return await viaFirecrawl(url, apiKey);
    } catch {
      // Fall through to the keyless path on any Firecrawl error/rate-limit.
    }
  }
  return viaHtml(url);
}
