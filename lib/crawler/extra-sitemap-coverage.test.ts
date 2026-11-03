import { describe, expect, it } from "vitest";
import { extraCoverageSitemaps, mergeSitemapCoverage, sitemapCoverageKey } from "./extra-sitemap-coverage";

const origin = "https://keeper0301.com";

it("only requests the known submitted category sitemap for the exact BlogFury property", () => {
  expect(extraCoverageSitemaps("site_blogfury", origin)).toEqual([origin + "/category-sitemap.xml"]);
  expect(extraCoverageSitemaps("site_blogfury", "http://keeper0301.com")).toEqual([]);
  expect(extraCoverageSitemaps("site_blogfury", "https://evil.keeper0301.com")).toEqual([]);
  expect(extraCoverageSitemaps("site_keepioo", origin)).toEqual([]);
});

describe("sitemap evidence union", () => {
  const primary = [origin + "/", origin + "/a-post"];
  const targets = ["/market-briefing", "/money-guides", "/smart-living"];

  it("removes only a category actually present in the extra XML", () => {
    const coverage = mergeSitemapCoverage(primary, targets.map(p => origin + p + "/"), origin);
    const keys = new Set(coverage.map(sitemapCoverageKey));
    for (const target of targets) expect(keys.has(sitemapCoverageKey(origin + target))).toBe(true);
    expect(keys.has(sitemapCoverageKey(origin + "/unlisted"))).toBe(false);
    expect(primary).toEqual([origin + "/", origin + "/a-post"]);
  });

  it("fails closed if the extra XML is unavailable", () => {
    const keys = new Set(mergeSitemapCoverage(primary, [], origin).map(sitemapCoverageKey));
    expect(keys.has(sitemapCoverageKey(origin + targets[0]))).toBe(false);
  });

  it("normalizes slash, escape casing and Unicode without admitting a foreign origin", () => {
    const xml = origin + "/market-briefing/%ec%bd%94%ec%8a%a4%ed%94%bc-%ec%bd%94%ec%8a%a4%eb%8b%a5-%ec%9a%94%ec%95%bd/";
    const crawled = origin + "/market-briefing/%EC%BD%94%EC%8A%A4%ED%94%BC-%EC%BD%94%EC%8A%A4%EB%8B%A5-%EC%9A%94%EC%95%BD";
    const keys = new Set(mergeSitemapCoverage(primary, [xml, "https://evil.example/extra", "http://keeper0301.com/extra", "garbage", origin + "/a-post"], origin).map(sitemapCoverageKey));
    expect(keys.has(sitemapCoverageKey(crawled))).toBe(true);
    expect(keys.has(sitemapCoverageKey(origin + "/extra"))).toBe(false);
    expect(keys.size).toBe(3);
  });
});
