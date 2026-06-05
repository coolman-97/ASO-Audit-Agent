import { describe, expect, it } from "vitest";
import { findAppStoreUrl, parseAppStoreUrl } from "./url";

describe("parseAppStoreUrl", () => {
  it("parses a canonical url with country + slug", () => {
    expect(
      parseAppStoreUrl(
        "https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580",
      ),
    ).toEqual({ appId: "324684580", country: "us" });
  });

  it("parses a non-US storefront", () => {
    expect(
      parseAppStoreUrl("https://apps.apple.com/gb/app/whatsapp-messenger/id310633997"),
    ).toEqual({ appId: "310633997", country: "gb" });
  });

  it("defaults country to us when absent", () => {
    expect(parseAppStoreUrl("https://apps.apple.com/app/id284882215?mt=8")).toEqual({
      appId: "284882215",
      country: "us",
    });
  });

  it("handles the legacy itunes.apple.com host", () => {
    expect(
      parseAppStoreUrl("https://itunes.apple.com/us/app/foo/id12345?ign-mpt=uo%3D4"),
    ).toEqual({ appId: "12345", country: "us" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseAppStoreUrl("  https://apps.apple.com/us/app/x/id999  ").appId).toBe("999");
  });

  it("rejects non-apple urls", () => {
    expect(() => parseAppStoreUrl("https://play.google.com/store/apps/details?id=x")).toThrow(
      /Apple App Store/i,
    );
  });

  it("rejects apple urls without a track id", () => {
    expect(() => parseAppStoreUrl("https://apps.apple.com/us/charts")).toThrow(/app id/i);
  });
});

describe("findAppStoreUrl", () => {
  it("extracts a url embedded in chat text", () => {
    const text =
      "hey can you audit https://apps.apple.com/us/app/spotify/id324684580 for me please";
    expect(findAppStoreUrl(text)).toBe("https://apps.apple.com/us/app/spotify/id324684580");
  });

  it("returns null when there is no url", () => {
    expect(findAppStoreUrl("audit spotify please")).toBeNull();
  });
});
