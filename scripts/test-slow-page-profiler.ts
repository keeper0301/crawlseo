import assert from "node:assert/strict";
import { classifySlowPage, summarizeSamples } from "./peonchi-slow-page-profiler";

assert.deepEqual(
  classifySlowPage({ crawlLoadMs: 6100, minMs: 3300, medianMs: 3500, maxMs: 3900 }),
  {
    diagnosis: "reproducible_slow",
    nextAction: "SSR/API/cache/CDN 병목을 우선 프로파일링한다.",
  }
);

assert.deepEqual(
  classifySlowPage({ crawlLoadMs: 6100, minMs: 900, medianMs: 1400, maxMs: 1800 }),
  {
    diagnosis: "crawler_or_cold_start_variance",
    nextAction: "크롤러 시간대·cold-start·캐시 miss를 분리 측정한 뒤 수정 범위를 정한다.",
  }
);

assert.deepEqual(
  classifySlowPage({ crawlLoadMs: 2900, minMs: 800, medianMs: 1800, maxMs: 2600 }),
  {
    diagnosis: "high_variance",
    nextAction: "응답 편차가 커서 CDN/cache hit ratio와 서버 cold path를 먼저 본다.",
  }
);

const summary = summarizeSamples("https://peonchi.com/en", 6548, [
  { run: 1, url: "https://peonchi.com/en", ok: true, status: 200, ms: 1000, bytes: 100, cache: "MISS" },
  { run: 2, url: "https://peonchi.com/en", ok: true, status: 200, ms: 1200, bytes: 120, cache: "HIT" },
  { run: 3, url: "https://peonchi.com/en", ok: false, status: null, ms: 20000, bytes: 0, cache: "error", error: "timeout" },
]);

assert.equal(summary.okRuns, 2);
assert.equal(summary.medianMs, 1100);
assert.equal(summary.avgBytes, 110);
assert.deepEqual(summary.cacheSignals, ["MISS", "HIT"]);
assert.equal(summary.diagnosis, "crawler_or_cold_start_variance");

console.log("slow-page profiler tests passed (8 assertions)");
