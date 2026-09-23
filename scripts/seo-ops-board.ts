import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { runSiteCrawl } from "@/lib/crawler/engine";
import { coverageWarnings, summarizeSitemapCoverage } from "@/lib/crawler/sitemap-sampling";
import { aggregateGscRows, summarizeGscCoverage } from "@/lib/ops-gsc-aggregation";
import {
  shouldIncludeIssueInOpsBoard,
  shouldIncludePageInOpsBoard,
} from "@/lib/ops-url-policy";

type SiteKey = "blogfury" | "keepioo" | "peonchi";

type Args = {
  site: "all" | SiteKey;
  crawl: boolean;
  maxPages: number;
  top: number;
  json: boolean;
  out?: string;
};

const SITE_MAP: Record<SiteKey, { id: string; label: string; goal: string; includeInDefault: boolean; includeInGlobalTop: boolean }> = {
  blogfury: {
    id: "site_blogfury",
    label: "BlogFury",
    goal: "수익형 SEO·색인·전환 페이지 개선",
    includeInDefault: true,
    includeInGlobalTop: true,
  },
  keepioo: {
    id: "site_keepioo",
    label: "키피오",
    goal: "정책정보 신뢰도·검색 유입·가입 CTA 개선",
    includeInDefault: true,
    includeInGlobalTop: true,
  },
  peonchi: {
    id: "site_peonchi",
    label: "펀치 여행사이트",
    goal: "Peonchi 여행 콘텐츠 검색 성장·GSC 학습·기술 SEO 개선",
    includeInDefault: true,
    includeInGlobalTop: true,
  },
};

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 100,
  WARNING: 45,
  INFO: 10,
};

const TYPE_WEIGHT: Record<string, number> = {
  BROKEN_LINK: 100,
  MIXED_CONTENT: 90,
  SLOW_PAGE: 82,
  MISSING_DESCRIPTION: 76,
  MISSING_H1: 72,
  MISSING_SITEMAP: 70,
  DUPLICATE_TITLE: 62,
  DUPLICATE_DESCRIPTION: 48,
  MISSING_ALT: 46,
  MISSING_SCHEMA: 34,
  ORPHAN_PAGE: 30,
};

const TYPE_KO: Record<string, { title: string; action: string; metric: string }> = {
  BROKEN_LINK: {
    title: "깨진 링크 정리",
    action: "404/오류 링크를 정상 URL로 교체하거나 제거한다.",
    metric: "크롤 오류·사용자 이탈 감소",
  },
  MIXED_CONTENT: {
    title: "HTTP/HTTPS 혼합 콘텐츠 제거",
    action: "본문·이미지·스크립트 URL을 https로 바꾸고 리다이렉트를 정리한다.",
    metric: "브라우저 경고·보안 신뢰도 개선",
  },
  SLOW_PAGE: {
    title: "느린 페이지 최적화",
    action: "큰 이미지 압축, 불필요 스크립트 제거, 캐시/CDN을 점검한다.",
    metric: "체류·전환·Core Web Vitals 개선",
  },
  MISSING_DESCRIPTION: {
    title: "메타 설명 보강",
    action: "페이지별 검색 의도와 클릭 이유가 보이는 90~150자 설명을 추가한다.",
    metric: "검색결과 CTR 개선 후보",
  },
  MISSING_H1: {
    title: "H1 제목 추가",
    action: "페이지 주제를 한 문장으로 설명하는 H1을 1개 추가한다.",
    metric: "페이지 주제 명확도 개선",
  },
  MISSING_SITEMAP: {
    title: "sitemap.xml 생성/제출",
    action: "인덱싱할 URL을 담은 sitemap.xml을 만들고 GSC에 제출한다.",
    metric: "신규/수정 페이지 발견성 개선",
  },
  DUPLICATE_TITLE: {
    title: "중복 title 분리",
    action: "로그인/가입/가격 등 목적별로 title을 다르게 쓴다.",
    metric: "검색결과 혼선·중복 신호 완화",
  },
  DUPLICATE_DESCRIPTION: {
    title: "중복 meta description 분리",
    action: "각 페이지의 다음 행동과 대상 사용자를 구분해서 description을 바꾼다.",
    metric: "CTR·랜딩 의도 일치 개선",
  },
  MISSING_ALT: {
    title: "이미지 alt 보강",
    action: "본문 핵심 이미지에 설명형 alt를 넣고 장식 이미지는 빈 alt로 처리한다.",
    metric: "이미지 검색·접근성·콘텐츠 이해도 개선",
  },
  MISSING_SCHEMA: {
    title: "구조화 데이터 점검",
    action: "Organization, WebSite, Article/FAQ 등 페이지 성격에 맞는 schema를 추가한다.",
    metric: "검색엔진 이해도·리치결과 후보 개선",
  },
  ORPHAN_PAGE: {
    title: "고아 페이지 내부 링크 보강",
    action: "사이트맵에만 있는 페이지가 의도된 정책 페이지인지 확인하고, 필요한 경우 관련 허브에서 내부 링크를 추가한다.",
    metric: "내부 탐색 경로·크롤 발견성 개선",
  },
};

function parseArgs(argv: string[]): Args {
  const args: Args = { site: "all", crawl: false, maxPages: 8, top: 5, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--crawl") args.crawl = true;
    else if (a === "--json") args.json = true;
    else if (a === "--site") args.site = argv[++i] as Args["site"];
    else if (a === "--max-pages") args.maxPages = Number(argv[++i] ?? 8);
    else if (a === "--top") args.top = Number(argv[++i] ?? 5);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: npx tsx scripts/seo-ops-board.ts [--site all|blogfury|keepioo|peonchi] [--crawl] [--max-pages 8] [--top 5] [--json] [--out PATH]`);
      process.exit(0);
    }
  }
  if (!["all", "blogfury", "keepioo", "peonchi"].includes(args.site)) {
    throw new Error(`Unknown --site: ${args.site}`);
  }
  if (!Number.isFinite(args.maxPages) || args.maxPages < 1 || args.maxPages > 2000) {
    throw new Error("--max-pages must be 1..2000");
  }
  if (!Number.isFinite(args.top) || args.top < 1 || args.top > 50) {
    throw new Error("--top must be 1..50");
  }
  return args;
}

function asDate(value: unknown): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function safeJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function issueScore(issue: { type: string; severity: string; details?: unknown }): number {
  const details = safeJson(issue.details);
  const base = (SEVERITY_WEIGHT[issue.severity] ?? 15) + (TYPE_WEIGHT[issue.type] ?? 30);
  const missing = typeof details.missing === "number" ? Math.min(details.missing, 80) : 0;
  const total = typeof details.total === "number" ? Math.min(details.total, 120) / 3 : 0;
  return Math.round(base + missing + total);
}

function cleanIssues<T extends { details?: unknown }>(issues: T[]): T[] {
  return issues.filter((issue) => {
    const kind = safeJson(issue.details).kind;
    return kind !== "crawl_summary" && kind !== "content_score";
  });
}

export function opsBoardIssueType(issue: { type?: string; details?: unknown }): string {
  const details = safeJson(issue.details);
  return issue.type === "MISSING_CANONICAL" && details.kind === "orphan"
    ? "ORPHAN_PAGE"
    : issue.type ?? "UNKNOWN";
}

function isExpectedPolicyOrphan(
  siteId: string | undefined,
  issue: { type?: string; url?: string; details?: unknown }
): boolean {
  if (siteId !== "site_keepioo" || opsBoardIssueType(issue) !== "ORPHAN_PAGE") return false;
  try {
    return new URL(issue.url ?? "").pathname === "/refund";
  } catch {
    return false;
  }
}

export function filterOpsBoardIssues<T extends { details?: unknown; url?: string; type?: string }>(issues: T[], siteId?: string): T[] {
  return cleanIssues(issues).filter((issue) => {
    // keepioo deliberately omits the transactional refund policy from the
    // footer while AdSense review mode is active; it remains canonical,
    // indexable, and present in the sitemap, so it is not an SEO action card.
    if (isExpectedPolicyOrphan(siteId, issue)) return false;
    if (siteId && issue.url && issue.type) {
      return shouldIncludeIssueInOpsBoard(siteId, issue.url, issue.type);
    }
    return true;
  });
}

export function summarizeOpsBoardIssueFiltering<T extends { details?: unknown; url?: string; type?: string }>(issues: T[], siteId?: string): { rawActionCandidates: T[]; actionIssues: T[]; suppressedIssues: number } {
  const rawActionCandidates = cleanIssues(issues);
  const actionIssues = filterOpsBoardIssues(issues, siteId);
  return {
    rawActionCandidates,
    actionIssues,
    suppressedIssues: Math.max(rawActionCandidates.length - actionIssues.length, 0),
  };
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function compactUrl(url: string): string {
  try {
    const u = new URL(url);
    const text = `${u.hostname}${u.pathname}`.replace(/\/$/, "/");
    return text.length > 86 ? `${text.slice(0, 83)}...` : text;
  } catch {
    return url.length > 86 ? `${url.slice(0, 83)}...` : url;
  }
}

async function maybeCrawl(siteIds: string[], maxPages: number) {
  for (const siteId of siteIds) {
    const site = await db.site.findUnique({ where: { id: siteId } });
    if (!site) continue;
    const pageRows = await db.page.findMany({ where: { siteId } });
    const preferredUrls = aggregateGscRows(pageRows, "url", 50).map((row) => row.key);
    console.error(`crawl:start ${site.domain} maxPages=${maxPages}`);
    const result = await runSiteCrawl(site.id, site.domain, maxPages, undefined, { preferredUrls });
    console.error(`crawl:done ${site.domain} pages=${result.pagesFound} issues=${result.issuesFound} health=${result.healthScore}`);
  }
}

async function loadSite(siteId: string) {
  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site) return null;
  const latest = await db.crawl.findFirst({
    where: { siteId: site.id, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: {
      issues: true,
      auditPages: { orderBy: { contentScore: "asc" }, take: 500 },
    },
  });
  const keywordRows = await db.keyword.findMany({ where: { siteId: site.id } });
  const pageRows = await db.page.findMany({ where: { siteId: site.id } });
  const keywords = aggregateGscRows(keywordRows, "query", 20);
  const pages = aggregateGscRows(pageRows, "url", 20);
  return {
    site,
    latest,
    keywords,
    pages,
    keywordCoverage: summarizeGscCoverage(keywordRows, "query"),
    pageCoverage: summarizeGscCoverage(pageRows, "url"),
  };
}

type BoardCard = {
  rank?: number;
  siteId: string;
  siteLabel: string;
  domain: string;
  type: string;
  severity: string;
  title: string;
  score: number;
  count: number;
  urls: string[];
  action: string;
  metric: string;
  blocker: string;
  evidence?: string[];
};

function issueEvidence(issue: { type: string; url: string; details?: unknown; message?: string }): string | null {
  const details = safeJson(issue.details);
  if (issue.type === "SLOW_PAGE" && typeof details.loadMs === "number") {
    return `${issue.url} — ${details.loadMs}ms`;
  }
  if (issue.type === "MISSING_ALT" && typeof details.missing === "number" && typeof details.total === "number") {
    return `${issue.url} — missing ${details.missing}/${details.total}`;
  }
  return issue.message ? `${issue.url} — ${issue.message}` : null;
}

function buildCards(siteLabel: string, domain: string, siteId: string, latest: NonNullable<Awaited<ReturnType<typeof loadSite>>>["latest"]): BoardCard[] {
  if (!latest) return [];
  const grouped = new Map<string, BoardCard>();
  for (const issue of filterOpsBoardIssues(latest.issues, siteId)) {
    const cardType = opsBoardIssueType(issue);
    const key = `${issue.severity}:${cardType}`;
    const meta = TYPE_KO[cardType] ?? {
      title: cardType,
      action: issue.message || "상세 문제를 확인하고 페이지 단위로 수정한다.",
      metric: "SEO issue 감소",
    };
    const card = grouped.get(key) ?? {
      siteId,
      siteLabel,
      domain,
      type: cardType,
      severity: issue.severity,
      title: meta.title,
      score: 0,
      count: 0,
      urls: [],
      action: meta.action,
      metric: meta.metric,
      blocker: "없음",
      evidence: [],
    };
    card.count += 1;
    card.score += issueScore(issue);
    card.urls.push(issue.url);
    const evidence = issueEvidence(issue);
    if (evidence) card.evidence?.push(evidence);
    grouped.set(key, card);
  }
  return Array.from(grouped.values()).map((card) => ({
    ...card,
    score: Math.round(card.score / Math.max(card.count, 1) + card.count * 8),
    urls: uniq(card.urls).slice(0, 5),
    evidence: uniq(card.evidence ?? []).slice(0, 5),
  })).sort((a, b) => b.score - a.score);
}

function healthTone(score: number | null | undefined): string {
  if (score == null) return "확인필요";
  if (score >= 90) return "양호";
  if (score >= 75) return "주의";
  if (score >= 60) return "개선필요";
  return "긴급개선";
}

function suppressedSummary(board: Awaited<ReturnType<typeof buildBoard>>): { total: number; siteLines: string[] } {
  const siteLines = board.sites.map((s) => {
    const suppressed = typeof s.suppressedIssues === "number" ? s.suppressedIssues : 0;
    const rawCandidates = suppressed + s.realIssues;
    return `- ${s.label}: 의도적 제외 ${suppressed}건 / action ${s.realIssues}건 / raw card 후보 ${rawCandidates}건`;
  });
  const total = board.sites.reduce((sum, s) => sum + (typeof s.suppressedIssues === "number" ? s.suppressedIssues : 0), 0);
  return { total, siteLines };
}

export function renderOpsBoardMarkdown(board: Awaited<ReturnType<typeof buildBoard>>, top: number): string {
  const lines: string[] = [];
  const suppression = suppressedSummary(board);
  lines.push("# CrawlSEO 실사용 SEO 운영판");
  lines.push("");
  lines.push(`- 생성: ${board.generatedAt}`);
  lines.push(`- 모드: ${board.crawlRun ? "신규 crawl 후 분석" : "기존 최신 crawl 분석"}`);
  lines.push(`- 안전선: 외부 게시·DB 운영계 변경 없음. 공개 사이트에 읽기 crawl만 수행.`);
  lines.push("");
  lines.push("## 결론");
  lines.push(`- 오늘 1순위: ${board.globalTop[0] ? `${board.globalTop[0].siteLabel} — ${board.globalTop[0].title}` : "새 문제 없음"}`);
  lines.push(`- 의도적 제외: ${suppression.total}건 (query/filter/search/account/noindex 계열 action-card 소음)`);
  lines.push(`- TOP${top} 작업: ${board.globalTop.slice(0, top).map((c) => `${c.siteLabel}/${c.title}`).join(" → ") || "없음"}`);
  lines.push("");
  lines.push("## 사이트 현황");
  for (const s of board.sites) {
    const suppressed = typeof s.suppressedIssues === "number" && s.suppressedIssues > 0 ? `, suppressed ${s.suppressedIssues}` : "";
    lines.push(`- ${s.label}: health ${s.health ?? "-"}/100 (${healthTone(s.health)}), pages ${s.pagesFound}, issues ${s.realIssues}${suppressed}, latest ${s.finishedAt}`);
  }
  lines.push("");
  lines.push("## 의도적 제외 요약");
  lines.push("- 기준: sitemap에 넣지 않는 query/filter/search/account/noindex 계열은 일반 SEO action card에서 제외한다.");
  lines.push("- 단, broken link/mixed content/slow page처럼 실제 장애성 이슈는 제외하지 않는다.");
  for (const line of suppression.siteLines) lines.push(line);
  lines.push("");
  lines.push(`## 바로 할 작업 TOP${top}`);
  for (const card of board.globalTop.slice(0, top)) {
    lines.push(`### ${card.rank}. ${card.siteLabel} — ${card.title}`);
    lines.push(`- 점수: ${card.score} / 심각도: ${card.severity} / 건수: ${card.count}`);
    lines.push(`- 목표: ${SITE_MAP[board.siteKeyById[card.siteId] as SiteKey]?.goal ?? "SEO 개선"}`);
    lines.push(`- 할 일: ${card.action}`);
    lines.push(`- 기대효과: ${card.metric}`);
    if (card.evidence?.length) {
      lines.push(`- 근거:`);
      for (const evidence of card.evidence) lines.push(`  - ${evidence}`);
    }
    lines.push(`- 대표 URL:`);
    for (const url of card.urls) lines.push(`  - ${url}`);
    lines.push("");
  }
  lines.push("## 사이트별 상세");
  for (const s of board.sites) {
    lines.push(`### ${s.label} (${s.domain})`);
    lines.push(`- Site ID: \`${s.siteId}\``);
    lines.push(`- 목표: ${s.goal}`);
    const suppressed = typeof s.suppressedIssues === "number" && s.suppressedIssues > 0 ? `, suppressed ${s.suppressedIssues}` : "";
    lines.push(`- 최신 crawl: ${s.finishedAt}, health ${s.health ?? "-"}, pages ${s.pagesFound}, raw issues ${s.rawIssues}, action issues ${s.realIssues}${suppressed}`);
    lines.push(`- crawl 표본: root ${s.crawlCoverage.root}, hub ${s.crawlCoverage.hub}, tool ${s.crawlCoverage.tool}, article ${s.crawlCoverage.article}, localized article ${s.crawlCoverage.localizedArticle}${s.crawlCoverageWarnings.length ? ` · coverage warning ${s.crawlCoverageWarnings.join(", ")}` : ""}`);
    lines.push(`- GSC 집계: query ${s.gscCoverage.keywords.uniqueCount}개/${s.gscCoverage.keywords.rowCount}행, URL ${s.gscCoverage.pages.uniqueCount}개/${s.gscCoverage.pages.rowCount}행, 기간 ${s.gscCoverage.pages.firstDate}~${s.gscCoverage.pages.lastDate}`);
    if (!s.cards.length) {
      lines.push("- 현재 조치할 crawl issue 없음");
    } else {
      for (const c of s.cards.slice(0, 8)) {
        lines.push(`- ${c.title}: ${c.count}건 / ${c.severity} / ${c.action}`);
      }
    }
    if (s.lowContentPages.length) {
      lines.push("- 콘텐츠 보강 후보:");
      for (const p of s.lowContentPages.slice(0, 5)) {
        lines.push(`  - ${compactUrl(p.url)} — score ${p.contentScore}, words ${p.wordCount}`);
      }
    }
    lines.push("");
  }
  lines.push("## 사용 명령");
  lines.push("```bash");
  lines.push("cd /home/user/.hermes/workspace/mcp-servers/crawlseo");
  lines.push("npm run ops:board -- --site all");
  lines.push("npm run ops:board:crawl -- --site all --max-pages 8");
  lines.push("npm run mcp:smoke:ops --silent");
  lines.push("```");
  lines.push("");
  lines.push("## 참고");
  lines.push("- GSC 클릭/노출은 아직 실연동 전이면 0으로 보인다.");
  lines.push("- Peonchi(site_peonchi)는 query/filter/search/account/noindex URL을 action-card 소음에서 제외한다.");
  lines.push("- 실제 WordPress/사이트 수정은 별도 승인·배포 경계 안에서 진행한다.");
  return lines.join("\n");
}

async function buildBoard(args: Args) {
  const selected = Object.entries(SITE_MAP)
    .filter(([key, value]) => args.site === "all" ? value.includeInDefault : key === args.site) as Array<[SiteKey, typeof SITE_MAP[SiteKey]]>;
  const siteIds = selected.map(([, value]) => value.id);
  if (args.crawl) await maybeCrawl(siteIds, args.maxPages);

  const siteKeyById = Object.fromEntries(selected.map(([key, value]) => [value.id, key]));
  const siteBoards = [];
  const allCards: BoardCard[] = [];
  for (const [key, meta] of selected) {
    const loaded = await loadSite(meta.id);
    if (!loaded) continue;
    const { actionIssues, suppressedIssues } = loaded.latest
      ? summarizeOpsBoardIssueFiltering(loaded.latest.issues, loaded.site.id)
      : { actionIssues: [], suppressedIssues: 0 };
    const cards = buildCards(meta.label, loaded.site.domain, loaded.site.id, loaded.latest);
    if (meta.includeInGlobalTop) {
      allCards.push(...cards);
    }
    const lowContentPages = (loaded.latest?.auditPages ?? [])
      .filter((p) => shouldIncludePageInOpsBoard(loaded.site.id, p.url))
      .filter((p) => p.contentScore < 85 || p.wordCount < 250)
      .map((p) => ({ url: p.url, contentScore: p.contentScore, wordCount: p.wordCount }))
      .slice(0, 20);
    const crawlUrls = (loaded.latest?.auditPages ?? []).map((page) => page.url);
    const crawlCoverage = summarizeSitemapCoverage(crawlUrls);
    const crawlCoverageWarnings = coverageWarnings(crawlCoverage);
    siteBoards.push({
      key,
      label: meta.label,
      goal: meta.goal,
      siteId: loaded.site.id,
      domain: loaded.site.domain,
      health: loaded.latest?.healthScore ?? null,
      pagesFound: loaded.latest?.pagesFound ?? 0,
      rawIssues: loaded.latest?.issuesFound ?? 0,
      realIssues: actionIssues.length,
      suppressedIssues,
      finishedAt: asDate(loaded.latest?.finishedAt),
      cards,
      lowContentPages,
      crawlCoverage,
      crawlCoverageWarnings,
      gscCoverage: {
        keywords: loaded.keywordCoverage,
        pages: loaded.pageCoverage,
      },
      keywords: loaded.keywords.map((k) => ({
        query: k.key,
        clicks: k.clicks,
        impressions: k.impressions,
        ctr: k.ctr,
        position: k.position,
        dataDays: k.dataDays,
      })),
      pages: loaded.pages.map((p) => ({
        url: p.key,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        position: p.position,
        dataDays: p.dataDays,
      })),
    });
  }
  const globalTop = allCards
    .sort((a, b) => b.score - a.score)
    .map((card, idx) => ({ ...card, rank: idx + 1 }));
  return {
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    crawlRun: args.crawl,
    maxPages: args.maxPages,
    siteKeyById,
    sites: siteBoards,
    globalTop,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const board = await buildBoard(args);
  const reportsDir = path.join(process.cwd(), "reports", "crawlseo");
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const md = renderOpsBoardMarkdown(board, args.top);
  const json = JSON.stringify(board, null, 2);
  const base = args.out ? path.resolve(args.out) : path.join(reportsDir, `ops-board-${stamp}`);
  const mdPath = base.endsWith(".md") ? base : `${base}.md`;
  const jsonPath = base.endsWith(".json") ? base : `${base}.json`;
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  writeFileSync(path.join(reportsDir, "latest.md"), md);
  writeFileSync(path.join(reportsDir, "latest.json"), json);
  console.log(args.json ? json : md);
  console.error(`report: ${mdPath}`);
  console.error(`json: ${jsonPath}`);
}

if (process.argv[1]?.endsWith("seo-ops-board.ts")) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
