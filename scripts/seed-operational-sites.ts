import { db } from "@/lib/db";

const owner = {
  id: "user_kgc_ops",
  email: "keeper0301@gmail.com",
  name: "관철 운영",
};

const sites = [
  {
    id: "site_blogfury",
    domain: "keeper0301.com",
    gscProperty: "sc-domain:keeper0301.com",
    keywords: ["정부지원금", "생활 정보", "건강 정보", "지역 정보", "지원 정책"],
    pages: ["https://keeper0301.com/"],
  },
  {
    id: "site_keepioo",
    domain: "www.keepioo.com",
    gscProperty: "https://www.keepioo.com/",
    keywords: ["지원금 정책", "청년 지원금", "정부지원금", "소상공인 정책자금", "복지 정책 알림"],
    pages: ["https://www.keepioo.com/", "https://www.keepioo.com/about", "https://www.keepioo.com/signup"],
  },

  {
    id: "site_peonchi",
    domain: "peonchi.com",
    gscProperty: "sc-domain:peonchi.com",
    keywords: ["펀치 여행", "여행 코스 추천", "도쿄 여행", "오사카 여행", "항공권 비교"],
    pages: [
      "https://peonchi.com/",
      "https://peonchi.com/flights",
      "https://peonchi.com/articles/tokyo-rainy-day-route-guide",
      "https://peonchi.com/articles/seoul-rainy-day-route-guide",
    ],
  },
];

function daysAgo(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function main() {
  await db.user.upsert({
    where: { email: owner.email },
    update: { name: owner.name },
    create: owner,
  });

  for (const site of sites) {
    await db.site.upsert({
      where: { id: site.id },
      update: { domain: site.domain, gscProperty: site.gscProperty },
      create: {
        id: site.id,
        userId: owner.id,
        domain: site.domain,
        gscProperty: site.gscProperty,
      },
    });

    // Lightweight starter rows so MCP dashboard-style tools return useful structure
    // until real GSC sync is connected.
    for (let i = 0; i < site.keywords.length; i++) {
      const query = site.keywords[i];
      const date = daysAgo(i + 1);
      await db.keyword.upsert({
        where: { siteId_query_date: { siteId: site.id, query, date } },
        update: {},
        create: {
          siteId: site.id,
          query,
          date,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          page: site.pages[0],
          country: site.domain.includes("keepioo") || site.domain.includes("peonchi") ? "KOR" : "USA",
          device: "DESKTOP",
        },
      });
    }

    for (let i = 0; i < site.pages.length; i++) {
      const url = site.pages[i];
      const date = daysAgo(i + 1);
      await db.page.upsert({
        where: { siteId_url_date: { siteId: site.id, url, date } },
        update: {},
        create: {
          siteId: site.id,
          url,
          date,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
        },
      });
    }
  }

  const all = await db.site.findMany({
    orderBy: { domain: "asc" },
    select: { id: true, domain: true, gscProperty: true, _count: { select: { keywords: true, pages: true, crawls: true } } },
  });
  console.log(JSON.stringify({ seeded: all }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
