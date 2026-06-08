import { generateText } from "ai";
import type { AppMetadata, VisualAnalysis } from "../schema";
import { getVisionModel } from "../model";
import { fetchWithTimeout } from "./http";

/**
 * Analyze the icon and the first couple of screenshots with a vision model.
 * Several rubric dimensions (Screenshots, Icon) reward reading the actual
 * creative, not just counting slots.
 *
 * We fetch each image ourselves (downscaled via Apple's CDN URL so payloads stay
 * small) and send ONE image per request - many hosted vision models (incl. the
 * NVIDIA NIM default) cap requests at a single image. Best-effort throughout: if
 * anything fails we degrade to `available: false` and the scorer falls back to
 * metadata-only heuristics.
 */

const MAX_SCREENSHOTS = 2;

/** Rewrite an mzstatic image URL to a small JPG box to keep the payload small. */
function downscale(url: string, box: number): string {
  return url.replace(/\/\d+x\d+(?:bb|sr|fn)?\.(?:png|jpe?g|webp)$/i, `/${box}x${box}bb.jpg`);
}

async function loadImage(url: string, box: number): Promise<Uint8Array> {
  const res = await fetchWithTimeout(downscale(url, box), { headers: { "User-Agent": "Mozilla/5.0" } }, 10_000);
  if (!res.ok) throw new Error(`image download failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Describe a SINGLE image. */
async function describe(prompt: string, url: string, box: number): Promise<string> {
  const image = await loadImage(url, box);
  const { text } = await generateText({
    model: getVisionModel(),
    messages: [
      { role: "user", content: [{ type: "text", text: prompt }, { type: "image", image, mediaType: "image/jpeg" }] },
    ],
  });
  return text.trim();
}

export async function analyzeVisuals(app: AppMetadata): Promise<VisualAnalysis> {
  const screenshots = (
    app.screenshotUrls.length > 0 ? app.screenshotUrls : app.ipadScreenshotUrls
  ).slice(0, MAX_SCREENSHOTS);

  const iconPromise = app.iconUrl
    ? describe(
        "You are an ASO expert. In 2-3 sentences, assess this app icon: Is it distinctive and " +
          "recognizable at small sizes? Category-appropriate? Does it rely on hard-to-read text? " +
          "Be specific about colors/shapes.",
        app.iconUrl,
        256,
      ).catch(() => null)
    : Promise.resolve(null);

  // One request per screenshot (single-image limit), then combine.
  const shotPromises = screenshots.map((url, i) =>
    describe(
      `You are an ASO expert reviewing App Store screenshot #${i + 1}. In 2 sentences: does it ` +
        "communicate value, is the on-image text large and readable (Apple OCR-indexes it), and is " +
        "the design polished? Quote any caption text you can read.",
      url,
      320,
    )
      .then((t) => `Screenshot ${i + 1}: ${t}`)
      .catch(() => null),
  );

  const [iconObservations, ...shotResults] = await Promise.all([iconPromise, ...shotPromises]);
  const shots = shotResults.filter((s): s is string => Boolean(s));
  const screenshotObservations = shots.length > 0 ? shots.join("\n") : null;

  return {
    available: Boolean(iconObservations || screenshotObservations),
    screenshotCount: app.screenshotUrls.length || app.ipadScreenshotUrls.length,
    iconObservations,
    screenshotObservations,
  };
}
