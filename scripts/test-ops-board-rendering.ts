import assert from "node:assert/strict";
import { renderOpsBoardMarkdown } from "./seo-ops-board";

type BoardFixture = Parameters<typeof renderOpsBoardMarkdown>[0];

const board = {
  generatedAt: "2026-08-15 18:10",
  crawlRun: false,
  maxPages: 8,
  siteKeyById: {
    site_peonchi: "peonchi",
  },
  sites: [
    {
      key: "peonchi",
      label: "펀치 여행사이트",
      goal: "Peonchi 여행 콘텐츠 검색 성장·GSC 학습·기술 SEO 개선",
      siteId: "site_peonchi",
      domain: "peonchi.com",
      health: 94,
      pagesFound: 8,
      rawIssues: 5,
      realIssues: 2,
      suppressedIssues: 3,
      finishedAt: "2026-08-15 00:00",
      cards: [
        {
          siteId: "site_peonchi",
          siteLabel: "펀치 여행사이트",
          domain: "peonchi.com",
          type: "SLOW_PAGE",
          severity: "WARNING",
          title: "느린 페이지 최적화",
          score: 143,
          count: 2,
          urls: ["https://peonchi.com/ja/guide"],
          action: "큰 이미지 압축, 불필요 스크립트 제거, 캐시/CDN을 점검한다.",
          metric: "체류·전환·Core Web Vitals 개선",
          blocker: "없음",
          evidence: ["https://peonchi.com/ja/guide — 3210ms"],
        },
      ],
      lowContentPages: [],
      crawlCoverage: { root: 1, hub: 2, tool: 1, article: 20, localizedArticle: 5, total: 29 },
      crawlCoverageWarnings: [],
      gscCoverage: {
        keywords: { rowCount: 30, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
        pages: { rowCount: 40, uniqueCount: 20, firstDate: "2026-08-01", lastDate: "2026-08-15", dataDays: 15 },
      },
      keywords: [],
      pages: [],
    },
  ],
  globalTop: [
    {
      rank: 1,
      siteId: "site_peonchi",
      siteLabel: "펀치 여행사이트",
      domain: "peonchi.com",
      type: "SLOW_PAGE",
      severity: "WARNING",
      title: "느린 페이지 최적화",
      score: 143,
      count: 2,
      urls: ["https://peonchi.com/ja/guide"],
      action: "큰 이미지 압축, 불필요 스크립트 제거, 캐시/CDN을 점검한다.",
      metric: "체류·전환·Core Web Vitals 개선",
      blocker: "없음",
      evidence: ["https://peonchi.com/ja/guide — 3210ms"],
    },
  ],
} satisfies BoardFixture;

const markdown = renderOpsBoardMarkdown(board, 5);

assert.match(markdown, /## 결론/);
assert.match(markdown, /의도적 제외: 3건 \(query\/filter\/search\/account\/noindex 계열 action-card 소음\)/);
assert.match(markdown, /## 의도적 제외 요약/);
assert.match(markdown, /sitemap에 넣지 않는 query\/filter\/search\/account\/noindex 계열/);
assert.match(markdown, /broken link\/mixed content\/slow page처럼 실제 장애성 이슈는 제외하지 않는다/);
assert.match(markdown, /펀치 여행사이트: 의도적 제외 3건 \/ action 2건 \/ raw card 후보 5건/);
assert.match(markdown, /raw issues 5, action issues 2, suppressed 3/);
assert.match(markdown, /근거:/);
assert.match(markdown, /https:\/\/peonchi\.com\/ja\/guide — 3210ms/);

console.log("ops-board rendering fixture tests passed (9 assertions)");
