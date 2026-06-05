import { generateText } from "ai";
import type { AppMetadata, VisualAnalysis } from "../schema";
import { getVisionModel } from "../model";

/**
 * Analyze the icon and the first few screenshots with a vision model. Several
 * rubric dimensions (Screenshots, Icon) reward reading the actual creative, not
 * just counting slots. This is best-effort: if the configured model can't do
 * vision (or anything fails), we degrade to `available: false` and the scorer
 * falls back to metadata-only heuristics.
 */

const MAX_SCREENSHOTS = 4;

async function describe(prompt: string, imageUrls: string[]): Promise<string> {
  const { text } = await generateText({
    model: getVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...imageUrls.map((url) => ({ type: "image" as const, image: new URL(url) })),
        ],
      },
    ],
  });
  return text.trim();
}

export async function analyzeVisuals(app: AppMetadata): Promise<VisualAnalysis> {
  const screenshots = (
    app.screenshotUrls.length > 0 ? app.screenshotUrls : app.ipadScreenshotUrls
  ).slice(0, MAX_SCREENSHOTS);

  const base: VisualAnalysis = {
    available: false,
    screenshotCount: app.screenshotUrls.length || app.ipadScreenshotUrls.length,
    iconObservations: null,
    screenshotObservations: null,
  };

  try {
    const [iconObservations, screenshotObservations] = await Promise.all([
      app.iconUrl
        ? describe(
            "You are an ASO expert. In 2-3 sentences, assess this app icon: Is it " +
              "distinctive and recognizable at small sizes? Category-appropriate? Does it " +
              "rely on hard-to-read text? Be specific about colors/shapes.",
            [app.iconUrl],
          )
        : Promise.resolve(null),
      screenshots.length > 0
        ? describe(
            "You are an ASO expert reviewing the first App Store screenshots. In 3-4 " +
              "sentences: Do the first 1-2 communicate the core value? Is on-image text " +
              "large and readable (Apple OCR-indexes it)? Is the design language cohesive? " +
              "Note any captions you can read.",
            screenshots,
          )
        : Promise.resolve(null),
    ]);

    return {
      ...base,
      available: Boolean(iconObservations || screenshotObservations),
      iconObservations,
      screenshotObservations,
    };
  } catch {
    return base;
  }
}
