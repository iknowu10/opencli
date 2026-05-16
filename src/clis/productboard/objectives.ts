import { cli, Strategy } from '../../registry.js';
import { pbFetch } from './utils.js';

cli({
  site: 'productboard',
  name: 'objectives',
  access: 'read',
  description: 'List objectives from Productboard',
  domain: 'ignitionapp.productboard.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 30, help: 'Max objectives to return' },
  ],
  columns: ['name', 'state', 'owner', 'start_date', 'end_date', 'id'],
  func: async (_page: any, kwargs: any) => {
    const limit = kwargs.limit || 30;
    const [objData, userData] = await Promise.all([
      pbFetch('/api/objectives'),
      pbFetch('/api/users'),
    ]);
    const objectives = objData?.objectives || [];
    const users = userData?.users || [];
    const userMap = new Map(users.map((u: any) => [u.id, u.name || u.email || '']));

    return objectives
      .filter((o: any) => !o.archived)
      .slice(0, limit)
      .map((o: any) => ({
        name: (o.name || '').slice(0, 80),
        state: String(o.state ?? ''),
        owner: userMap.get(o.ownerId) || '',
        start_date: o.startDate || '',
        end_date: o.endDate || '',
        id: o.id || '',
      }));
  },
});
