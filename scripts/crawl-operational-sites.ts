import { db } from "@/lib/db";
import { runSiteCrawl } from "@/lib/crawler/engine";

const targets = [
  { id: "site_blogfury", maxPages: 8 },
  { id: "site_keepioo", maxPages: 8 },
  { id: "site_peonchi", maxPages: 8 },
];

async function main() {
  const results: unknown[] = [];
  for (const target of targets) {
    const site = await db.site.findUnique({ where: { id: target.id }, select: { id: true, domain: true } });
    if (!site) {
      results.push({ siteId: target.id, error: "site not found" });
      continue;
    }
    console.log(`crawl:start ${site.domain}`);
    try {
      const result = await runSiteCrawl(site.id, site.domain, target.maxPages);
      results.push({ site: site.domain, ...result });
      console.log(`crawl:done ${site.domain} pages=${result.pagesFound} issues=${result.issuesFound} health=${result.healthScore}`);
    } catch (err) {
      results.push({ site: site.domain, error: err instanceof Error ? err.message : String(err) });
      console.error(`crawl:failed ${site.domain}`, err);
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
