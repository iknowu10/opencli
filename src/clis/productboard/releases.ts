import { cli, Strategy } from '../../registry.js';
import { pbFetch } from './utils.js';

cli({
  site: 'productboard',
  name: 'releases',
  access: 'read',
  description: 'List releases from Productboard',
  domain: 'ignitionapp.productboard.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['name', 'state', 'owner', 'start_date', 'end_date', 'id'],
  func: async () => {
    const [relData, userData] = await Promise.all([
      pbFetch('/api/releases'),
      pbFetch('/api/users'),
    ]);
    const releases = relData?.releases || [];
    const users = userData?.users || [];
    const userMap = new Map(users.map((u: any) => [u.id, u.name || u.email || '']));

    return releases
      .filter((r: any) => !r.archived)
      .map((r: any) => ({
        name: r.name || '',
        state: r.state || '',
        owner: userMap.get(r.ownerId) || '',
        start_date: r.startDate || '',
        end_date: r.endDate || '',
        id: r.id || '',
      }));
  },
});
