import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../lib/db";
import { shouldIncludeIssueInOpsBoard } from "../lib/ops-url-policy";

type Args = {
  siteId: string;
  runs: number;
  top: number;
  json: boolean;
  out?: string;
};

type Sample = {
  run: number;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  bytes: number;
  cache: string;
  error?: string;
};

type UrlSummary = {
  url: string;
  crawlLoadMs: number | null;
  runs: number;
  okRuns: number;
  minMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
  avgMs: number | null;
  avgBytes: number | null;
  cacheSignals: string[];
  diagnosis: string;
  nextAction: string;
};

const SITE_LABEL: Record<string, string> = {
  site_peonchi: "펀치 여행사이트",
  site_keepioo: "키피오",
  site_blogfury: "BlogFury",
};

function parseArgs(argv: string[]): Args {
  const args: Args = { siteId: "site_peonchi", runs: 3, top: 5, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--site-id") args.siteId = argv[++i] ?? args.siteId;
    else if (a === "--runs") args.runs = Number(argv[++i] ?? args.runs);
    else if (a === "--top") args.top = Number(argv[++i] ?? args.top);
    else if (a === "--json") args.json = true;
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log("Usage: npx tsx scripts/peonchi-slow-page-profiler.ts [--site-id site_peonchi] [--runs 3] [--top 5] [--json] [--out PATH]");
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.runs) || args.runs < 1 || args.runs > 10) throw new Error("--runs must be 1..10");
  if (!Number.isFinite(args.top) || args.top < 1 || args.top > 20) throw new Error("--top must be 1..20");
  if (args.siteId === "site_punchtravel") throw new Error("site_punchtravel is out of scope; use site_peonchi for Punch/Peonchi work");
  return args;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function round(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

export function classifySlowPage(summary: Pick<UrlSummary, "crawlLoadMs" | "minMs" | "medianMs" | "maxMs">): { diagnosis: string; nextAction: string } {
  const crawl = summary.crawlLoadMs ?? 0;
  const min = summary.minMs ?? 0;
  const med = summary.medianMs ?? 0;
  const max = summary.maxMs ?? 0;
  if (med >= 3000) {
    return {
      diagnosis: "reproducible_slow",
      nextAction: "SSR/API/cache/CDN 병목을 우선 프로파일링한다.",
    };
  }
  if (crawl >= 3000 && med < 2200) {
    return {
      diagnosis: "crawler_or_cold_start_variance",
      nextAction: "크롤러 시간대·cold-start·캐시 miss를 분리 측정한 뒤 수정 범위를 정한다.",
    };
  }
  if (max - min >= 1500) {
    return {
      diagnosis: "high_variance",
      nextAction: "응답 편차가 커서 CDN/cache hit ratio와 서버 cold path를 먼저 본다.",
    };
  }
  return {
    diagnosis: "watch_only",
    nextAction: "현재 재현 속도는 양호하므로 다음 크롤까지 관찰한다.",
  };
}

export function summarizeSamples(url: string, crawlLoadMs: number | null, samples: Sample[]): UrlSummary {
  const ok = samples.filter((sample) => sample.ok);
  const values = ok.map((sample) => sample.ms);
  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const avgBytes = ok.length ? ok.reduce((sum, sample) => sum + sample.bytes, 0) / ok.length : null;
  const cacheSignals = Array.from(new Set(ok.map((sample) => sample.cache).filter(Boolean)));
  const base = {
    url,
    crawlLoadMs,
    runs: samples.length,
    okRuns: ok.length,
    minMs: values.length ? Math.min(...values) : null,
    medianMs: median(values),
    maxMs: values.length ? Math.max(...values) : null,
    avgMs: round(avg),
    avgBytes: round(avgBytes),
    cacheSignals,
  };
  return { ...base, ...classifySlowPage(base) };
}

async function fetchSample(url: string, run: number): Promise<Sample> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CrawlSEO-Ops-Profiler/1.0 (+https://github.com/crawlseo/crawlseo)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const buf = await res.arrayBuffer();
    const cache = [
      res.headers.get("x-vercel-cache"),
      res.headers.get("cf-cache-status"),
      res.headers.get("x-cache"),
    ].filter(Boolean).join("/") || "unknown";
    return { run, url, ok: res.ok, status: res.status, ms: Date.now() - started, bytes: buf.byteLength, cache };
  } catch (err) {
    return { run, url, ok: false, status: null, ms: Date.now() - started, bytes: 0, cache: "error", error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function latestSlowUrls(siteId: string, top: number): Promise<Array<{ url: string; crawlLoadMs: number | null }>> {
  const latest = await db.crawl.findFirst({
    where: { siteId, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: { issues: true },
  });
  if (!latest) return [];
  return latest.issues
    .filter((issue) => issue.type === "SLOW_PAGE" && shouldIncludeIssueInOpsBoard(siteId, issue.url, issue.type))
    .map((issue) => ({ url: issue.url, crawlLoadMs: asNumber(safeJson(issue.details).loadMs) }))
    .slice(0, top);
}

function render(report: { generatedAt: string; siteId: string; siteLabel: string; summaries: UrlSummary[] }): string {
  const lines: string[] = [];
  lines.push(`# CrawlSEO slow page profiler`);
  lines.push("");
  lines.push(`- 생성: ${report.generatedAt}`);
  lines.push(`- 사이트: ${report.siteLabel} (${report.siteId})`);
  lines.push(`- 안전선: read-only fetch only / 배포·DB mutation·GSC·IndexNow 없음`);
  lines.push("");
  lines.push("## 결론");
  if (!report.summaries.length) {
    lines.push("- SLOW_PAGE action card 없음");
  } else {
    const buckets = report.summaries.reduce<Record<string, number>>((acc, s) => {
      acc[s.diagnosis] = (acc[s.diagnosis] ?? 0) + 1;
      return acc;
    }, {});
    lines.push(`- 진단: ${Object.entries(buckets).map(([k, v]) => `${k} ${v}건`).join(" / ")}`);
    lines.push(`- 다음: ${report.summaries[0].nextAction}`);
  }
  lines.push("");
  lines.push("## URL별 측정");
  for (const s of report.summaries) {
    lines.push(`- ${s.url}`);
    lines.push(`  - crawl: ${s.crawlLoadMs ?? "-"}ms / measured median: ${s.medianMs ?? "-"}ms / min-max: ${s.minMs ?? "-"}-${s.maxMs ?? "-"}ms / ok ${s.okRuns}/${s.runs}`);
    lines.push(`  - bytes(avg): ${s.avgBytes ?? "-"} / cache: ${s.cacheSignals.join(", ") || "unknown"}`);
    lines.push(`  - diagnosis: ${s.diagnosis}`);
    lines.push(`  - next: ${s.nextAction}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await latestSlowUrls(args.siteId, args.top);
  const samplesByUrl = new Map<string, Sample[]>();
  for (const target of targets) samplesByUrl.set(target.url, []);
  for (let run = 1; run <= args.runs; run += 1) {
    const batch = await Promise.all(targets.map((target) => fetchSample(target.url, run)));
    for (const sample of batch) samplesByUrl.get(sample.url)?.push(sample);
  }
  const summaries = targets.map((target) => summarizeSamples(target.url, target.crawlLoadMs, samplesByUrl.get(target.url) ?? []));
  const report = {
    generatedAt: new Date().toISOString(),
    siteId: args.siteId,
    siteLabel: SITE_LABEL[args.siteId] ?? args.siteId,
    runs: args.runs,
    summaries,
    samples: Object.fromEntries([...samplesByUrl.entries()]),
  };
  const reportsDir = path.join(process.cwd(), "reports", "crawlseo");
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = args.out ? path.resolve(args.out) : path.join(reportsDir, `slow-page-profiler-${args.siteId}-${stamp}`);
  const mdPath = base.endsWith(".md") ? base : `${base}.md`;
  const jsonPath = base.endsWith(".json") ? base : `${base}.json`;
  writeFileSync(mdPath, render(report), "utf8");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(render(report));
  console.error(`report: ${mdPath}`);
  console.error(`json: ${jsonPath}`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
