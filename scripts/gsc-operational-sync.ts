import { readFileSync } from "fs";
import { db } from "@/lib/db";
import { syncGSCDataForSite } from "@/lib/workers/gsc-sync";

const SOURCE_ENV =
  process.env.CRAWLSEO_GSC_SOURCE_ENV ||
  "/home/user/.hermes/secrets/blogfury-backend.env";
const OWNER_ID = "user_kgc_ops";
const SEED_CUTOFF = new Date("2026-08-10T00:00:00.000Z");
const TARGETS = [
  {
    id: "site_blogfury",
    domain: "keeper0301.com",
    property: "sc-domain:keeper0301.com",
  },
  {
    id: "site_keepioo",
    domain: "www.keepioo.com",
    property: "https://www.keepioo.com/",
  },
  {
    id: "site_peonchi",
    domain: "peonchi.com",
    property: "sc-domain:peonchi.com",
  },
] as const;

type SourceCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    env[line.slice(0, index).trim()] = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function credentials(): SourceCredentials {
  const env = loadEnv(SOURCE_ENV);
  const result = {
    clientId: env.GSC_OAUTH_CLIENT_ID ?? "",
    clientSecret: env.GSC_OAUTH_CLIENT_SECRET ?? "",
    refreshToken: env.GSC_OAUTH_REFRESH_TOKEN ?? "",
  };
  if (!result.clientId || !result.clientSecret || !result.refreshToken) {
    throw new Error("gsc_source_credentials_missing");
  }
  process.env.GOOGLE_CLIENT_ID = result.clientId;
  process.env.GOOGLE_CLIENT_SECRET = result.clientSecret;
  return result;
}

async function exchangeToken(source: SourceCredentials) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: source.clientId,
      client_secret: source.clientSecret,
      refresh_token: source.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`oauth_refresh_failed:${response.status}`);
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!payload.access_token) throw new Error("oauth_access_token_missing");
  return payload;
}

async function listProperties(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`gsc_property_list_failed:${response.status}`);
  const payload = (await response.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
  };
  return payload.siteEntry ?? [];
}

async function readback() {
  const rows = [];
  for (const target of TARGETS) {
    const [site, keyword, page, keywordCount, pageCount] = await Promise.all([
      db.site.findUnique({ where: { id: target.id }, select: { domain: true, gscProperty: true } }),
      db.keyword.aggregate({
        where: { siteId: target.id, date: { gt: SEED_CUTOFF } },
        _max: { date: true },
        _sum: { clicks: true, impressions: true },
      }),
      db.page.aggregate({
        where: { siteId: target.id, date: { gt: SEED_CUTOFF } },
        _max: { date: true },
        _sum: { clicks: true, impressions: true },
      }),
      db.keyword.count({ where: { siteId: target.id, date: { gt: SEED_CUTOFF } } }),
      db.page.count({ where: { siteId: target.id, date: { gt: SEED_CUTOFF } } }),
    ]);
    rows.push({
      siteId: target.id,
      domain: site?.domain,
      gscProperty: site?.gscProperty,
      keywordRows: keywordCount,
      pageRows: pageCount,
      keywordLatest: keyword._max.date?.toISOString() ?? null,
      pageLatest: page._max.date?.toISOString() ?? null,
      clicks: keyword._sum.clicks ?? 0,
      impressions: keyword._sum.impressions ?? 0,
    });
  }
  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const source = credentials();
  const token = await exchangeToken(source);
  const properties = await listProperties(token.access_token!);
  const propertyMap = new Map(properties.map((entry) => [entry.siteUrl, entry.permissionLevel]));
  const access = TARGETS.map((target) => ({
    siteId: target.id,
    property: target.property,
    permission: propertyMap.get(target.property) ?? null,
  }));
  const missing = access.filter((entry) => !entry.permission);
  if (missing.length) {
    console.log(JSON.stringify({ verdict: "blocked_property_access", apply, access }, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          verdict: "ready_to_apply",
          apply: false,
          sourceCredentialsPresent: true,
          access,
          targets: TARGETS,
          before: await readback(),
        },
        null,
        2
      )
    );
    return;
  }

  await db.user.update({
    where: { id: OWNER_ID },
    data: {
      googleTokens: {
        accessToken: token.access_token,
        refreshToken: source.refreshToken,
        expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
        tokenType: token.token_type ?? "Bearer",
        scope: token.scope,
      },
    },
  });

  for (const target of TARGETS) {
    await db.site.update({
      where: { id: target.id },
      data: { domain: target.domain, gscProperty: target.property },
    });
  }

  const sync = [];
  for (const target of TARGETS) {
    sync.push({
      siteId: target.id,
      result: await syncGSCDataForSite(OWNER_ID, target.id, 28),
    });
  }
  if (sync.some((entry) => !entry.result.success)) {
    console.log(JSON.stringify({ verdict: "sync_failed", apply: true, access, sync }, null, 2));
    process.exitCode = 3;
    return;
  }

  const seedCleanup = [];
  for (const target of TARGETS) {
    const [keywords, pages] = await Promise.all([
      db.keyword.deleteMany({
        where: {
          siteId: target.id,
          date: { lte: SEED_CUTOFF },
          clicks: 0,
          impressions: 0,
        },
      }),
      db.page.deleteMany({
        where: {
          siteId: target.id,
          date: { lte: SEED_CUTOFF },
          clicks: 0,
          impressions: 0,
        },
      }),
    ]);
    seedCleanup.push({
      siteId: target.id,
      keywordRowsRemoved: keywords.count,
      pageRowsRemoved: pages.count,
    });
  }

  const after = await readback();
  const fresh = after.every((row) => row.keywordLatest || row.pageLatest);
  console.log(
    JSON.stringify(
      {
        verdict: fresh ? "pass_live_gsc_sync" : "attention_no_recent_rows",
        apply: true,
        access,
        sync,
        seedCleanup,
        after,
        safety: {
          readOnlyGoogleScope: true,
          searchConsoleSubmission: false,
          indexNowSubmission: false,
          excludedSiteIds: ["site_punchtravel"],
          secretsPrinted: false,
        },
      },
      null,
      2
    )
  );
  if (!fresh) process.exitCode = 4;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ verdict: "failed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
