// BlogFury has a separately submitted category sitemap. Its robots-declared
// fallback sitemap contains posts only; this source is coverage evidence, not
// another source of page seeds. Never guess child names for other sites.
export function extraCoverageSitemaps(siteId: string, origin: string): string[] {
  return siteId === "site_blogfury" && origin === "https://keeper0301.com"
    ? [`${origin}/category-sitemap.xml`]
    : [];
}

export function mergeSitemapCoverage(primary: string[], additional: string[], origin: string): string[] {
  const safe = additional.filter((candidate) => {
    try {
      const url = new URL(candidate);
      return url.origin === origin && url.protocol === "https:" && !url.search && !url.hash;
    } catch {
      return false;
    }
  });
  return [...new Set([...primary, ...safe])];
}

// The crawler removes trailing slashes but may retain percent-escape casing.
// Compare canonical paths, not the raw encoding of a valid same-site URL.
export function sitemapCoverageKey(raw: string): string {
  try {
    const url = new URL(raw);
    const path = decodeURI(url.pathname).normalize("NFC").replace(/\/$/, "") || "/";
    return `${url.origin}${path}`;
  } catch {
    return raw;
  }
}
