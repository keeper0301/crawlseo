import assert from "node:assert/strict";
import { renderOpsBoardMarkdown } from "./seo-ops-board";

type BoardFixture = Parameters<typeof renderOpsBoardMarkdown>[0];

const board = {
  generatedAt: "2026-08-15 20:30",
  crawlRun: false,
  maxPages: 8,
  siteKeyById: {
    site_peonchi: "peonchi",
    site_blogfury: "blogfury",
  },
  sites: [
    {
      key: "peonchi",
      label: "펀치 여행사이트",
      goal: "Peonchi 여행 콘텐츠 검색 성장·GSC 학습·기술 SEO 개선",
      siteId: "site_peonchi",
      domain: "peonchi.com",
      health: 94,
      pagesFound: 8,
      rawIssues: 5,
      realIssues: 2,
      suppressedIssues: 3,
      finishedAt: "2026-08-15 00:00",
      cards: [],
      lowContentPages: [],
      crawlCoverage: { root: 1, hub: 2, tool: 1, article: 20, localizedArticle: 5, total: 29 },
      crawlCoverageWarnings: [],
      gscCoverage: {
        keywords: { rowCount: 30, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
        pages: { rowCount: 40, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
      },
      keywords: [],
      pages: [],
    },
    {
      key: "blogfury",
      label: "BlogFury",
      goal: "수익형 SEO·색인·전환 페이지 개선",
      siteId: "site_blogfury",
      domain: "blogfury.com",
      health: 86,
      pagesFound: 8,
      rawIssues: 7,
      realIssues: 6,
      suppressedIssues: 0,
      finishedAt: "2026-08-15 00:00",
      cards: [],
      lowContentPages: [],
      crawlCoverage: { root: 1, hub: 2, tool: 1, article: 20, localizedArticle: 5, total: 29 },
      crawlCoverageWarnings: [],
      gscCoverage: {
        keywords: { rowCount: 30, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
        pages: { rowCount: 40, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
      },
      keywords: [],
      pages: [],
    },
  ],
  globalTop: [],
} satisfies BoardFixture;

const parsed = JSON.parse(JSON.stringify(board)) as {
  sites?: Array<{
    siteId?: string;
    rawIssues?: unknown;
    realIssues?: unknown;
    suppressedIssues?: unknown;
  }>;
};

assert.ok(Array.isArray(parsed.sites), "board JSON must contain a sites array");
assert.equal(parsed.sites.length, 2, "fixture must include all site contract cases");

for (const site of parsed.sites) {
  assert.equal(typeof site.siteId, "string", "siteId must remain present in site JSON contract");
  assert.equal(typeof site.rawIssues, "number", `${site.siteId} rawIssues must be numeric`);
  assert.equal(typeof site.realIssues, "number", `${site.siteId} realIssues must be numeric`);
  assert.equal(typeof site.suppressedIssues, "number", `${site.siteId} suppressedIssues must be numeric`);
  const rawIssues = site.rawIssues as number;
  const realIssues = site.realIssues as number;
  const suppressedIssues = site.suppressedIssues as number;
  assert.ok(rawIssues >= realIssues, `${site.siteId} rawIssues should be >= action issues`);
  assert.ok(suppressedIssues >= 0, `${site.siteId} suppressedIssues must be non-negative`);
}

const peonchi = parsed.sites.find((site) => site.siteId === "site_peonchi");
assert.ok(peonchi, "site_peonchi must stay in JSON contract");
assert.equal(peonchi.suppressedIssues, 3, "Peonchi suppression count must survive JSON serialization");
assert.equal((peonchi.rawIssues as number) - (peonchi.realIssues as number), 3, "fixture raw/action delta should match suppressed count");

const blogfury = parsed.sites.find((site) => site.siteId === "site_blogfury");
assert.ok(blogfury, "non-Peonchi site must stay in JSON contract");
assert.equal(blogfury.suppressedIssues, 0, "non-suppressed sites must emit explicit zero, not omit the field");

console.log("ops-board JSON contract tests passed (suppressedIssues numeric and explicit)");
