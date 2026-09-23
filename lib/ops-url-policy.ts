export type OpsUrlFamily =
  | "indexable_public"
  | "excluded_query_filter"
  | "excluded_search"
  | "excluded_account_auth"
  | "excluded_admin_api"
  | "excluded_utility_noindex"
  | "excluded_placeholder"
  | "excluded_not_found"
  | "unknown";

export type OpsUrlPolicy = {
  family: OpsUrlFamily;
  includeInBoard: boolean;
  includeInSitemap: boolean;
  reason: string;
};

const PEONCHI_QUERY_PARAMS = new Set([
  "city",
  "companion",
  "mood",
  "region",
  "page",
  "starRating",
  "order",
  "src",
  "from",
  "type",
]);

const EXEMPT_CRAWLSEO_TYPES = new Set([
  "MISSING_SITEMAP",
  "MISSING_CANONICAL",
  "DUPLICATE_TITLE",
  "DUPLICATE_DESCRIPTION",
  "MISSING_DESCRIPTION",
  "MISSING_SCHEMA",
  "MISSING_H1",
  "MULTIPLE_H1",
  "LARGE_PAGE",
]);

const ALWAYS_ACTIONABLE_TYPES = new Set([
  "BROKEN_LINK",
  "MIXED_CONTENT",
  "SLOW_PAGE",
]);

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const maybeLocale = parts[0];
  if (["en", "ja", "zh", "fr", "es"].includes(maybeLocale ?? "")) {
    return `/${parts.slice(1).join("/")}` || "/";
  }
  return path;
}

function parseUrl(url: string, fallbackDomain?: string): URL | null {
  try {
    return new URL(url);
  } catch {
    if (!fallbackDomain) return null;
    try {
      return new URL(url.startsWith("/") ? `https://${fallbackDomain}${url}` : `https://${fallbackDomain}/${url}`);
    } catch {
      return null;
    }
  }
}

export function classifyPeonchiUrl(url: string, issueType?: string): OpsUrlPolicy {
  const parsed = parseUrl(url, "peonchi.com");
  if (!parsed) {
    return {
      family: "unknown",
      includeInBoard: true,
      includeInSitemap: false,
      reason: "URL parse failed; keep visible for manual review.",
    };
  }

  const path = normalizePath(parsed.pathname);
  const hasPolicyQuery = Array.from(parsed.searchParams.keys()).some((key) => PEONCHI_QUERY_PARAMS.has(key));
  const alwaysActionable = issueType ? ALWAYS_ACTIONABLE_TYPES.has(issueType) : false;
  const canSuppress = issueType ? EXEMPT_CRAWLSEO_TYPES.has(issueType) : true;

  if (hasPolicyQuery && !alwaysActionable && canSuppress) {
    return {
      family: "excluded_query_filter",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Peonchi query/filter URL should stay out of sitemap and use noindex,follow with a clean canonical.",
    };
  }

  if ((path === "/search" || path.startsWith("/search/")) && !alwaysActionable && canSuppress) {
    return {
      family: "excluded_search",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Internal search/results pages are not sitemap/action-card targets.",
    };
  }

  if ((path === "/login" || path.startsWith("/auth") || path === "/me" || path.startsWith("/me/")) && !alwaysActionable && canSuppress) {
    return {
      family: "excluded_account_auth",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Account/auth/personal URLs are intentionally noindex or robots-disallowed.",
    };
  }

  if ((path.startsWith("/admin") || path.startsWith("/api")) && !alwaysActionable && canSuppress) {
    return {
      family: "excluded_admin_api",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Admin/API URLs are robots-disallowed; fix crawl seed exposure rather than page SEO.",
    };
  }

  if ((path === "/credits" || path === "/404" || path === "/not-found") && !alwaysActionable && canSuppress) {
    return {
      family: path === "/credits" ? "excluded_utility_noindex" : "excluded_not_found",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Utility/not-found page is intentionally excluded from sitemap and action-card SEO work.",
    };
  }

  if (path.startsWith("/places/") && !alwaysActionable && canSuppress) {
    return {
      family: "excluded_placeholder",
      includeInBoard: false,
      includeInSitemap: false,
      reason: "Place placeholder URLs are noindex until they redirect to published article URLs.",
    };
  }

  return {
    family: "indexable_public",
    includeInBoard: true,
    includeInSitemap: true,
    reason: "Clean public URL; keep CrawlSEO issue actionable.",
  };
}

export function shouldIncludeIssueInOpsBoard(siteId: string, url: string, issueType: string): boolean {
  if (siteId !== "site_peonchi") return true;
  return classifyPeonchiUrl(url, issueType).includeInBoard;
}

export function shouldIncludePageInOpsBoard(siteId: string, url: string): boolean {
  if (siteId !== "site_peonchi") return true;
  return classifyPeonchiUrl(url).includeInBoard;
}
