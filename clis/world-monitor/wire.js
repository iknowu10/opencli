/**
 * World Monitor — THE WIRE: real-time global conflict and incident feed.
 *
 * Uses the public /api/events JSON endpoint — no browser needed.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';

const SEVERITY_MAP = { 1: 'LOW', 2: 'MODERATE', 3: 'ELEVATED', 4: 'HIGH', 5: 'CRITICAL' };

cli({
  site: 'world-monitor',
  name: 'wire',
  description: 'Real-time global conflict & incident feed from World Monitor',
  domain: 'world-monitor.com',
  strategy: Strategy.PUBLIC,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Number of incidents (default 20, max 100)' },
    { name: 'filter', type: 'string', default: '', help: 'Filter by keyword (e.g. "iran", "ukraine")' },
    { name: 'severity', type: 'int', default: 0, help: 'Minimum severity 1-5 (0 = all)' },
  ],
  columns: ['severity', 'country', 'headline', 'source', 'url'],
  func: async (page, kwargs) => {
    const limit = Math.min(kwargs.limit || 20, 100);
    const filter = (kwargs.filter || '').toLowerCase();
    const minSeverity = kwargs.severity || 0;

    const resp = await fetch('https://world-monitor.com/api/events');
    if (!resp.ok) return [];
    const data = await resp.json();
    const markers = data.markers || [];

    let results = markers
      .filter(m => m.headline && m.severity >= minSeverity)
      .map(m => ({
        severity: SEVERITY_MAP[m.severity] || String(m.severity),
        country: m.country || m.actor1 || '',
        headline: (m.headline || '').substring(0, 200),
        source: m.source || '',
        url: m.sourceUrl || '',
      }));

    if (filter) {
      results = results.filter(r => {
        const text = `${r.country} ${r.headline} ${r.source}`.toLowerCase();
        return text.includes(filter);
      });
    }

    // Sort by severity descending
    const severityOrder = { CRITICAL: 5, HIGH: 4, ELEVATED: 3, MODERATE: 2, LOW: 1 };
    results.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

    return results.slice(0, limit);
  },
});
