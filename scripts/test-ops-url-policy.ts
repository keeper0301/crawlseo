import assert from "node:assert/strict";
import {
  classifyPeonchiUrl,
  shouldIncludeIssueInOpsBoard,
  shouldIncludePageInOpsBoard,
} from "@/lib/ops-url-policy";

const cases = [
  {
    label: "clean public category is actionable",
    url: "https://peonchi.com/en/category/places",
    issueType: "DUPLICATE_TITLE",
    include: true,
    family: "indexable_public",
  },
  {
    label: "category filter duplicate is suppressed",
    url: "https://peonchi.com/en/category/places?city=seoul",
    issueType: "DUPLICATE_DESCRIPTION",
    include: false,
    family: "excluded_query_filter",
  },
  {
    label: "hotel sort missing sitemap is suppressed",
    url: "https://peonchi.com/en/hotels/tokyo?order=price_asc",
    issueType: "MISSING_SITEMAP",
    include: false,
    family: "excluded_query_filter",
  },
  {
    label: "activity tracking schema noise is suppressed",
    url: "https://peonchi.com/activities/tokyo?src=monetization_path&from=hotel-hub-tokyo&type=activity",
    issueType: "MISSING_SCHEMA",
    include: false,
    family: "excluded_query_filter",
  },
  {
    label: "query URL broken link remains actionable",
    url: "https://peonchi.com/en/category/places?city=seoul",
    issueType: "BROKEN_LINK",
    include: true,
    family: "indexable_public",
  },
  {
    label: "search page noise is suppressed",
    url: "https://peonchi.com/search?q=tokyo",
    issueType: "MISSING_DESCRIPTION",
    include: false,
    family: "excluded_search",
  },
  {
    label: "account page noise is suppressed",
    url: "https://peonchi.com/me/favorites",
    issueType: "MISSING_H1",
    include: false,
    family: "excluded_account_auth",
  },
  {
    label: "admin/API page noise is suppressed",
    url: "https://peonchi.com/api/cron/daily",
    issueType: "MISSING_CANONICAL",
    include: false,
    family: "excluded_admin_api",
  },
  {
    label: "credits page noise is suppressed",
    url: "https://peonchi.com/credits",
    issueType: "MISSING_SITEMAP",
    include: false,
    family: "excluded_utility_noindex",
  },
  {
    label: "place placeholder noise is suppressed",
    url: "https://peonchi.com/places/12345",
    issueType: "DUPLICATE_TITLE",
    include: false,
    family: "excluded_placeholder",
  },
] as const;

for (const item of cases) {
  const result = classifyPeonchiUrl(item.url, item.issueType);
  assert.equal(result.family, item.family, item.label);
  assert.equal(result.includeInBoard, item.include, item.label);
  assert.equal(shouldIncludeIssueInOpsBoard("site_peonchi", item.url, item.issueType), item.include, item.label);
}

assert.equal(
  shouldIncludeIssueInOpsBoard("site_blogfury", "https://blogfury.com/login", "DUPLICATE_TITLE"),
  true,
  "non-Peonchi sites must not be filtered by Peonchi policy",
);

assert.equal(
  shouldIncludePageInOpsBoard("site_peonchi", "https://peonchi.com/en/category/places?city=seoul"),
  false,
  "low-content query pages should not become ops-board candidates",
);

console.log(`ops-url-policy tests passed (${cases.length + 2} assertions)`);
