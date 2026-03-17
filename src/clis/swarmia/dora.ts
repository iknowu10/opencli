import { cli, Strategy } from '../../registry.js';
import { swarmiaGet, parseCsv, timeframeParams } from '../../swarmia.js';

cli({
  site: 'swarmia',
  name: 'dora',
  description: 'DORA metrics (requires SWARMIA_TOKEN)',
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
    { name: 'app', default: '', help: 'Filter by deployment app name(s), comma-separated' },
  ],
  columns: ['period', 'deploy_freq', 'lead_time_min', 'failure_rate', 'mttr_min', 'deploy_count'],
  func: async (_page, kwargs) => {
    const params = { ...timeframeParams(kwargs), app: kwargs.app || undefined };
    const csv = await swarmiaGet('/reports/dora', params);
    return parseCsv(csv).map(r => ({
      period: `${r['Start Date']} – ${r['End Date']}`,
      deploy_freq: r['Deployment Frequency (per day)'] ?? '',
      lead_time_min: r['Change Lead Time Minutes'] ?? '',
      failure_rate: r['Change Failure Rate (%)'] ?? '',
      mttr_min: r['Mean Time to Recovery Minutes'] ?? '',
      deploy_count: r['Deployment Count'] ?? '',
    }));
  },
});
