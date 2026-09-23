export type SitemapCoverage = {
  root: number;
  hub: number;
  tool: number;
  article: number;
  localizedArticle: number;
  total: number;
};

export type SitemapClass = Exclude<keyof SitemapCoverage, "total">;

export function classifySitemapUrl(raw: string): SitemapClass {
  const path = new URL(raw).pathname.replace(/\/$/, "") || "/";
  if (path === "/") return "root";
  if (/^\/(en|ja|zh|fr|es)\/articles\//.test(path)) return "localizedArticle";
  if (/^\/articles\//.test(path)) return "article";
  if (/^\/tools(?:\/|$)/.test(path)) return "tool";
  return "hub";
}

export function summarizeSitemapCoverage(urls: string[]): SitemapCoverage {
  const result: SitemapCoverage = {
    root: 0,
    hub: 0,
    tool: 0,
    article: 0,
    localizedArticle: 0,
    total: urls.length,
  };
  for (const url of urls) result[classifySitemapUrl(url)] += 1;
  return result;
}

export function coverageWarnings(coverage: SitemapCoverage): string[] {
  const warnings: string[] = [];
  if (coverage.root === 0) warnings.push("root_missing");
  if (coverage.hub === 0) warnings.push("hub_missing");
  if (coverage.tool === 0) warnings.push("tool_missing");
  if (coverage.article === 0) warnings.push("article_missing");
  if (coverage.localizedArticle === 0) warnings.push("localized_article_missing");
  return warnings;
}

export function selectRepresentativeSitemapUrls(
  urls: string[],
  limit: number,
  preferredUrls: string[] = []
): string[] {
  if (limit <= 0) return [];
  const unique = [...new Set(urls)].sort();
  const available = new Set(unique);
  const selected: string[] = [];
  const origin = unique[0] ? new URL(unique[0]).origin : null;
  const add = (url: string) => {
    if (available.has(url) && !selected.includes(url) && selected.length < limit) selected.push(url);
  };
  const addPreferred = (url: string) => {
    let sameOrigin = false;
    try {
      sameOrigin = origin !== null && new URL(url).origin === origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin && !selected.includes(url) && selected.length < limit) selected.push(url);
  };

  const groups = new Map<SitemapClass, string[]>();
  for (const url of unique) {
    const kind = classifySitemapUrl(url);
    groups.set(kind, [...(groups.get(kind) ?? []), url]);
  }

  const quota: Array<[SitemapClass, number]> = [
    ["root", 1],
    ["article", Math.min(20, Math.floor(limit * 0.5))],
    ["localizedArticle", Math.min(5, Math.max(1, Math.floor(limit * 0.125)))],
    ["tool", Math.min(4, Math.max(1, Math.floor(limit * 0.1)))],
    ["hub", Math.min(5, Math.max(1, Math.floor(limit * 0.125)))],
  ];
  for (const [kind, count] of quota) {
    for (const url of (groups.get(kind) ?? []).slice(0, count)) add(url);
  }
  // Add high-impression GSC URLs after reserving coverage quotas, so they
  // cannot crowd localized articles or tools out of a bounded crawl.
  const localizedPreferred = preferredUrls.filter((url) => classifySitemapUrl(url) === "localizedArticle");
  for (const url of localizedPreferred) addPreferred(url);
  for (const url of preferredUrls) addPreferred(url);
  for (const url of unique) add(url);
  return selected;
}
