import { cli, Strategy } from '../../registry.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── Known teams ──────────────────────────────────────────────────────────────

const TEAMS: Record<string, { id: string; members: Record<string, string> }> = {
  Interstellar: {
    id: '67022149-71ed-4f7f-bc12-8cf64c693ef6',
    members: {
      'Bill Tran':      '3147f7ea-f1f6-4fec-91f7-deda814e91aa',
      'Daniel Norman':  'e496ceef-9745-422c-b5a6-45b4173f7aaf',
      'David Evans':    '2a6b0fd7-1f01-4fab-93bb-d99d730be011',
      'Dylan McKay':    '2616b1b2-eaf8-4db9-be7f-18784d46c521',
      'Joseph Chiang':  '60356db7-e622-457d-b19c-f37d0f35ae1b',
      'Jun Huang':      'e78e871e-60f5-4a29-9b96-fa04937eb70a',
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readSessionCookie(): string {
  if (process.env.SWARMIA_SESSION_COOKIE) return decodeURIComponent(process.env.SWARMIA_SESSION_COOKIE);
  const rcPath = path.join(os.homedir(), 'ignition', '.claude', 'skills', 'dev-team-metrics', '.swarmiarc');
  try {
    for (const line of fs.readFileSync(rcPath, 'utf-8').split('\n')) {
      if (line.trim().startsWith('session_cookie=')) {
        return decodeURIComponent(line.split('=').slice(1).join('=').trim());
      }
    }
  } catch {}
  throw new Error('No Swarmia session cookie found. Set SWARMIA_SESSION_COOKIE or add session_cookie= to .swarmiarc');
}

function computeDates(timeframe: string, start?: string, end?: string) {
  if (start && end) return { start, end };
  const days: Record<string, number> = {
    last_7_days: 7, last_14_days: 14, last_30_days: 30,
    last_60_days: 60, last_90_days: 90,
  };
  const n = days[timeframe] ?? 14;
  const now = new Date();
  const s = new Date(now.getTime() - n * 86400000);
  return {
    start: s.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

async function graphql(cookie: string, query: string, variables?: Record<string, any>): Promise<any> {
  const r = await fetch('https://app.swarmia.com/graphql', {
    method: 'POST',
    headers: { Cookie: 'session=' + cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
  });
  const data = await r.json() as any;
  if (data?.errors) throw new Error(data.errors[0]?.message ?? 'GraphQL error');
  return data.data;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

cli({
  site: 'swarmia',
  name: 'member-prs',
  description: 'PR activity for a specific team member',
  domain: 'app.swarmia.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'member', default: '', help: 'Member name, e.g. "Jun Huang". Omit to list all Interstellar members.' },
    { name: 'team', default: 'Interstellar', help: 'Team name (default: Interstellar)' },
    { name: 'timeframe', default: 'last_14_days', help: 'last_7_days, last_14_days, last_30_days, last_60_days, last_90_days' },
    { name: 'start', default: '', help: 'Start date YYYY-MM-DD (overrides timeframe)' },
    { name: 'end', default: '', help: 'End date YYYY-MM-DD (overrides timeframe)' },
  ],
  columns: ['member', 'merged', 'open', 'closed', 'reviewed', 'period'],
  func: async (_page, kwargs) => {
    const teamName = kwargs.team || 'Interstellar';
    const team = TEAMS[teamName];
    if (!team) throw new Error(`Unknown team: ${teamName}. Known: ${Object.keys(TEAMS).join(', ')}`);

    const dates = computeDates(kwargs.timeframe, kwargs.start || undefined, kwargs.end || undefined);
    const cookie = readSessionCookie();

    const memberFilter = (kwargs.member || '').trim();
    const targetIds = memberFilter
      ? (() => {
          const id = team.members[memberFilter];
          if (!id) throw new Error(`Unknown member: "${memberFilter}". Known: ${Object.keys(team.members).join(', ')}`);
          return new Set([id]);
        })()
      : new Set(Object.values(team.members));

    // Convert local date range to UTC (assume AEST UTC+11)
    const startUTC = new Date(dates.start + 'T00:00:00+11:00').toISOString();
    const endUTC   = new Date(dates.end   + 'T23:59:59+11:00').toISOString();
    const inRange = (s: string) => s >= startUTC && s <= endUTC;

    // Fetch authored PRs (for merged/open/closed counts) and all reviews (for reviewed count)
    const [prData, reviewData] = await Promise.all([
      graphql(cookie, `{
        filters: pullRequestFilters {
          authored: fromOurTeam(
            teamId: "${team.id}"
            startDate: "${dates.start}"
            endDate: "${dates.end}"
          ) {
            nodes { id status author { id } }
          }
        }
      }`),
      graphql(cookie, 'query reviews($f: Filter) { pullRequestReviews(filter: $f) { id submittedAt author { id } pullRequest { id author { id } } } }', { f: {} }),
    ]);

    const authored: any[] = prData?.filters?.authored?.nodes ?? [];
    const allReviews: any[] = reviewData?.pullRequestReviews ?? [];

    // Aggregate per member
    const stats: Record<string, { merged: number; open: number; closed: number; reviewed: number }> = {};
    for (const id of targetIds) {
      stats[id] = { merged: 0, open: 0, closed: 0, reviewed: 0 };
    }

    for (const pr of authored) {
      const authorId = pr.author?.id;
      if (authorId && stats[authorId]) {
        if (pr.status === 'MERGED') stats[authorId].merged++;
        else if (pr.status === 'OPEN') stats[authorId].open++;
        else if (pr.status === 'CLOSED') stats[authorId].closed++;
      }
    }

    // Count reviews per member using direct review data (excludes self-reviews)
    const reviewedPRs: Record<string, Set<string>> = {};
    for (const id of targetIds) reviewedPRs[id] = new Set();

    for (const rv of allReviews) {
      const reviewerId = rv.author?.id;
      if (!reviewerId || !reviewedPRs[reviewerId]) continue;
      if (!inRange(rv.submittedAt)) continue;
      if (rv.pullRequest?.author?.id === reviewerId) continue; // exclude self-reviews
      reviewedPRs[reviewerId].add(rv.pullRequest?.id);
    }

    for (const id of targetIds) {
      stats[id].reviewed = reviewedPRs[id].size;
    }

    const nameById = Object.fromEntries(Object.entries(team.members).map(([n, id]) => [id, n]));
    const period = `${dates.start} – ${dates.end}`;

    return [...targetIds].map(id => ({
      member:   nameById[id] ?? id,
      merged:   stats[id].merged,
      open:     stats[id].open,
      closed:   stats[id].closed,
      reviewed: stats[id].reviewed,
      period,
    }));
  },
});
