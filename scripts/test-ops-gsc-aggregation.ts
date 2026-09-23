import assert from "node:assert/strict";
import { aggregateGscRows, summarizeGscCoverage } from "../lib/ops-gsc-aggregation";

const rows = [
  { query: "후쿠오카 쇼핑", date: "2026-09-01", clicks: 1, impressions: 100, ctr: 0.01, position: 10 },
  { query: "후쿠오카 쇼핑", date: "2026-09-02", clicks: 3, impressions: 200, ctr: 0.015, position: 8 },
  { query: "삿포로 쇼핑", date: "2026-09-01", clicks: 2, impressions: 50, ctr: 0.04, position: 7 },
];
const aggregated = aggregateGscRows(rows, "query", 20);
assert.equal(aggregated.length, 2);
assert.equal(aggregated[0].key, "후쿠오카 쇼핑");
assert.equal(aggregated[0].clicks, 4);
assert.equal(aggregated[0].impressions, 300);
assert.equal(aggregated[0].ctr, 4 / 300);
assert.equal(aggregated[0].position, (10 * 100 + 8 * 200) / 300);
assert.equal(aggregated[0].dataDays, 2);
assert.deepEqual(summarizeGscCoverage(rows, "query"), {
  rowCount: 3,
  uniqueCount: 2,
  firstDate: "2026-09-01",
  lastDate: "2026-09-02",
  dataDays: 2,
});
console.log("ops-gsc-aggregation: ok");
