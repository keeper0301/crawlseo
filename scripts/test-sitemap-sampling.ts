import assert from "node:assert/strict";
import {
  coverageWarnings,
  selectRepresentativeSitemapUrls,
  summarizeSitemapCoverage,
} from "../lib/crawler/sitemap-sampling";

const origin = "https://peonchi.com";
const urls = [origin, ...Array.from({ length: 30 }, (_, i) => `${origin}/articles/article-${String(i).padStart(2, "0")}`), ...Array.from({ length: 12 }, (_, i) => `${origin}/en/articles/article-${String(i).padStart(2, "0")}`), `${origin}/tools/exchange`, `${origin}/tools/budget`, `${origin}/hotels`, `${origin}/flights`, `${origin}/policy`];
const preferred = [
  `${origin}/articles/article-29`,
  ...Array.from({ length: 5 }, (_, i) => `${origin}/zh/articles/gsc-only-${i}`),
];
const selected = selectRepresentativeSitemapUrls(urls, 40, preferred);
const coverage = summarizeSitemapCoverage(selected);
assert.equal(selected.length, 40);
assert.ok(selected.includes(preferred[0]));
assert.ok(coverage.article >= 20);
assert.ok(coverage.localizedArticle >= 5);
assert.ok(coverage.root >= 1);
assert.ok(coverage.tool >= 1);
assert.ok(coverage.hub >= 1);
assert.deepEqual(coverageWarnings(coverage), []);
assert.deepEqual(selectRepresentativeSitemapUrls(urls, 40, preferred), selected);
console.log("sitemap-sampling: ok", coverage);
