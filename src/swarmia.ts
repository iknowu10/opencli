/** Shared utilities for Swarmia API adapters */

const BASE = 'https://app.swarmia.com/api/v0';

export function getToken(): string {
  const token = process.env.SWARMIA_TOKEN;
  if (!token) throw new Error('SWARMIA_TOKEN environment variable is not set');
  return token;
}

export async function swarmiaGet(path: string, params: Record<string, string | undefined>): Promise<string> {
  const token = getToken();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Swarmia API error ${res.status}: ${await res.text()}`);
  return res.text();
}

/** Parse a CSV string into an array of objects using the header row as keys */
export function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Build timeframe params from CLI args */
export function timeframeParams(kwargs: Record<string, any>): Record<string, string | undefined> {
  if (kwargs.start && kwargs.end) {
    return { startDate: kwargs.start, endDate: kwargs.end };
  }
  return { timeframe: kwargs.timeframe ?? 'last_30_days' };
}
