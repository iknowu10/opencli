import { cli, Strategy } from '../../registry.js';
import { swarmiaGet, parseCsv } from '../../swarmia.js';

cli({
  site: 'swarmia',
  name: 'investment',
  description: 'Investment balance by category (requires SWARMIA_TOKEN)',
  domain: 'app.swarmia.com',
  strategy: Strategy.HEADER,
  browser: false,
  args: [
    { name: 'start', required: true, help: 'First day of start month YYYY-MM-DD' },
    { name: 'end', required: true, help: 'Last day of end month YYYY-MM-DD' },
  ],
  columns: ['period', 'category', 'fte_months', 'relative_pct', 'commits', 'pr_merges'],
  func: async (_page, kwargs) => {
    const csv = await swarmiaGet('/reports/investment', { startDate: kwargs.start, endDate: kwargs.end });
    return parseCsv(csv).map(r => ({
      period: `${r['Start Date']} – ${r['End Date']}`,
      category: r['Investment Category'] ?? '',
      fte_months: r['FTE months'] ?? '',
      relative_pct: r['Relative Percentage'] ?? '',
      commits: r['Commits'] ?? '',
      pr_merges: r['Pull Request Merges'] ?? '',
    }));
  },
});
