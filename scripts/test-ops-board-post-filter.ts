import assert from "node:assert/strict";
import {
  filterOpsBoardIssues,
  opsBoardIssueType,
  summarizeOpsBoardIssueFiltering,
} from "./seo-ops-board";

type SyntheticIssue = {
  url: string;
  type: string;
  severity: string;
  message: string;
  details?: unknown;
};

const issues: SyntheticIssue[] = [
  {
    url: "https://peonchi.com/en/category/places?city=seoul",
    type: "DUPLICATE_TITLE",
    severity: "WARNING",
    message: "Query/filter duplicate title should be suppressed",
  },
  {
    url: "https://peonchi.com/search?q=tokyo",
    type: "MISSING_DESCRIPTION",
    severity: "WARNING",
    message: "Search page metadata noise should be suppressed",
  },
  {
    url: "https://peonchi.com/me/favorites",
    type: "MISSING_H1",
    severity: "WARNING",
    message: "Account page noise should be suppressed",
  },
  {
    url: "https://peonchi.com/en/category/places?city=seoul",
    type: "BROKEN_LINK",
    severity: "ERROR",
    message: "Query URL broken link must remain actionable",
  },
  {
    url: "https://peonchi.com/search?q=tokyo",
    type: "SLOW_PAGE",
    severity: "WARNING",
    message: "Search page slow issue must remain actionable",
  },
  {
    url: "https://peonchi.com/articles/tokyo-rainy-day-route-guide",
    type: "MISSING_DESCRIPTION",
    severity: "WARNING",
    message: "Clean public page remains actionable",
  },
  {
    url: "https://peonchi.com/__crawl_summary",
    type: "CRAWL_SUMMARY",
    severity: "INFO",
    message: "Synthetic summary must never enter raw action candidates",
    details: { kind: "crawl_summary" },
  },
];

const summary = summarizeOpsBoardIssueFiltering(issues, "site_peonchi");
const actionIssues = filterOpsBoardIssues(issues, "site_peonchi");

assert.equal(summary.rawActionCandidates.length, 6, "crawl summary records must be removed before post-filter counting");
assert.equal(actionIssues.length, 3, "three Peonchi issues should remain actionable");
assert.equal(summary.actionIssues.length, 3, "summary actionIssues should match actual filtered action issues");
assert.equal(summary.suppressedIssues, 3, "query/search/account noise should increment suppressedIssues");

const actionTypes = new Set(actionIssues.map((issue) => issue.type));
assert.ok(actionTypes.has("BROKEN_LINK"), "BROKEN_LINK must remain actionable even on query/search/account URL families");
assert.ok(actionTypes.has("SLOW_PAGE"), "SLOW_PAGE must remain actionable even on query/search/account URL families");
assert.ok(actionTypes.has("MISSING_DESCRIPTION"), "clean public page issue must remain actionable");
assert.equal(actionTypes.has("DUPLICATE_TITLE"), false, "query/filter duplicate title noise should be suppressed");
assert.equal(actionIssues.some((issue) => issue.url.includes("/me/")), false, "account page noise should be suppressed");

const nonPeonchiSummary = summarizeOpsBoardIssueFiltering(issues, "site_blogfury");
assert.equal(nonPeonchiSummary.rawActionCandidates.length, 6, "non-Peonchi raw action candidates still drop crawl summary records");
assert.equal(nonPeonchiSummary.actionIssues.length, 6, "non-Peonchi sites must not use Peonchi suppression rules");
assert.equal(nonPeonchiSummary.suppressedIssues, 0, "non-Peonchi sites should not increment Peonchi suppression count");

const keepiooRefundOrphan: SyntheticIssue = {
  url: "https://www.keepioo.com/refund",
  type: "MISSING_CANONICAL",
  severity: "WARNING",
  message: "Potential orphan page",
  details: { kind: "orphan" },
};
assert.equal(
  opsBoardIssueType(keepiooRefundOrphan),
  "ORPHAN_PAGE",
  "orphan findings must not be presented as missing canonical"
);
assert.equal(
  filterOpsBoardIssues([keepiooRefundOrphan], "site_keepioo").length,
  0,
  "the intentional keepioo refund policy orphan must be suppressed while review mode is active"
);
assert.equal(
  filterOpsBoardIssues([keepiooRefundOrphan], "site_blogfury").length,
  1,
  "the keepioo-specific suppression must not leak to other sites"
);

console.log("ops-board post-filter synthetic tests passed (suppression increments; broken/slow remain actionable)");
