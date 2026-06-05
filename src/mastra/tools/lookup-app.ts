import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { lookupAppByUrl } from "../services/itunes";

/** Slim card the chat renders so the user can confirm the right app. */
export const appCardSchema = z.object({
  appId: z.string(),
  country: z.string(),
  name: z.string(),
  developer: z.string(),
  iconUrl: z.string(),
  primaryGenre: z.string(),
  averageUserRating: z.number().nullable(),
  userRatingCount: z.number().nullable(),
  trackViewUrl: z.string(),
  url: z.string(),
});

/**
 * Step 2 of the flow: fetch SURFACE metadata only, for the "is this the app you
 * meant?" confirmation. Cheap, fast, no LLM — just Apple's lookup API.
 */
export const lookupAppTool = createTool({
  id: "lookupApp",
  description:
    "Fetch surface-level metadata (name, developer, icon, category, country, rating) for an " +
    "Apple App Store URL so the user can confirm it's the right app. Call this when the user " +
    "provides an App Store link. Does NOT run the audit.",
  inputSchema: z.object({
    url: z.string().describe("The Apple App Store URL the user pasted."),
  }),
  outputSchema: appCardSchema,
  execute: async (inputData) => {
    const app = await lookupAppByUrl(inputData.url);
    return {
      appId: app.appId,
      country: app.country,
      name: app.name,
      developer: app.developer,
      iconUrl: app.iconUrl,
      primaryGenre: app.primaryGenre,
      averageUserRating: app.averageUserRating ?? null,
      userRatingCount: app.userRatingCount ?? null,
      trackViewUrl: app.trackViewUrl,
      url: inputData.url,
    };
  },
});
