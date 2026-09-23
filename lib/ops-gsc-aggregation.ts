export type GscMetricRow = {
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
  date: Date | string | number;
  query?: string;
  url?: string;
};

export type AggregatedGscRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  firstDate: string;
  lastDate: string;
  dataDays: number;
};

function dateKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

export function aggregateGscRows(
  rows: GscMetricRow[],
  dimension: "query" | "url",
  limit = 20
): AggregatedGscRow[] {
  const grouped = new Map<string, {
    clicks: number;
    impressions: number;
    weightedPosition: number;
    dates: Set<string>;
  }>();

  for (const row of rows) {
    const key = row[dimension]?.trim();
    if (!key) continue;
    const impressions = Number.isFinite(row.impressions) ? Math.max(row.impressions, 0) : 0;
    const clicks = Number.isFinite(row.clicks) ? Math.max(row.clicks, 0) : 0;
    const position = Number.isFinite(row.position) ? Math.max(row.position, 0) : 0;
    const current = grouped.get(key) ?? {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      dates: new Set<string>(),
    };
    current.clicks += clicks;
    current.impressions += impressions;
    current.weightedPosition += position * impressions;
    current.dates.add(dateKey(row.date));
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, value]) => {
      const dates = [...value.dates].sort();
      return {
        key,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
        position: value.impressions > 0 ? value.weightedPosition / value.impressions : 0,
        firstDate: dates[0] ?? "-",
        lastDate: dates.at(-1) ?? "-",
        dataDays: dates.length,
      };
    })
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function summarizeGscCoverage(rows: GscMetricRow[], dimension: "query" | "url") {
  const keys = new Set(rows.map((row) => row[dimension]?.trim()).filter(Boolean));
  const dates = [...new Set(rows.map((row) => dateKey(row.date)))].sort();
  return {
    rowCount: rows.length,
    uniqueCount: keys.size,
    firstDate: dates[0] ?? "-",
    lastDate: dates.at(-1) ?? "-",
    dataDays: dates.length,
  };
}
