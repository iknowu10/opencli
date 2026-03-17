import { cli, Strategy } from '../../registry.js';
import { swarmiaGet, parseCsv, timeframeParams } from '../../swarmia.js';

cli({
  site: 'swarmia',
  name: 'pull-requests',
  description: 'Pull request metrics by team (requires SWARMIA_TOKEN)',
  domain: 'app.swarmia.com',
  strategy: Strategy.HEADER,
  browser: false,
  args: [
    {
      name: 'timeframe',
      default: 'last_30_days',
      help: 'Preset period: last_7_days, last_14_days, last_30_days, last_60_days, last_90_days, last_180_days, last_365_days',
    },
    { name: 'start', default: '', help: 'Start date YYYY-MM-DD (overrides timeframe)' },
    { name: 'end', default: '', help: 'End date YYYY-MM-DD (overrides timeframe)' },
  ],
  columns: ['team', 'cycle_time', 'review_rate', 'time_to_first_review', 'prs_per_week', 'merge_time', 'contributors'],
  func: async (_page, kwargs) => {
    const csv = await swarmiaGet('/reports/pullRequests', timeframeParams(kwargs));
    return parseCsv(csv).map(r => ({
      team: r['Team'] ?? '',
      cycle_time: r['Cycle Time (s)'] ?? '',
      review_rate: r['Review Rate (%)'] ?? '',
      time_to_first_review: r['Time to first review (s)'] ?? '',
      prs_per_week: r['PRs merged / week'] ?? '',
      merge_time: r['Merge Time (s)'] ?? '',
      contributors: r['Contributors'] ?? '',
    }));
  },
});
