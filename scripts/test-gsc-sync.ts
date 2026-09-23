import assert from "node:assert/strict";
import { mapSearchAnalyticsRow } from "@/lib/google/gsc-client";

const row = {
  keys: ["peonchi travel", "2026-09-21"],
  clicks: 3,
  impressions: 120,
  ctr: 0.025,
  position: 8.456,
};

const mapped = mapSearchAnalyticsRow(row, ["query", "date"], "2026-09-20");
assert.deepEqual(mapped, {
  query: "peonchi travel",
  page: undefined,
  device: undefined,
  country: undefined,
  clicks: 3,
  impressions: 120,
  ctr: 0.025,
  position: 8.46,
  date: "2026-09-21",
});

const fallback = mapSearchAnalyticsRow(
  { ...row, keys: ["peonchi travel"] },
  ["query"],
  "2026-09-20"
);
assert.equal(fallback.date, "2026-09-20");

console.log("GSC analytics row mapping tests passed");
