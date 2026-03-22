import { cli, Strategy } from '../../registry.js';
import { pbFetch } from './utils.js';

cli({
  site: 'productboard',
  name: 'features',
  description: 'List features from Productboard',
  domain: 'ignitionapp.productboard.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 30, help: 'Max features to return' },
  ],
  columns: ['name', 'type', 'owner', 'updated_at', 'id'],
  func: async (_page: any, kwargs: any) => {
    const limit = kwargs.limit || 30;
    const [featData, userData] = await Promise.all([
      pbFetch('/api/features'),
      pbFetch('/api/users'),
    ]);
    const features = featData?.features || [];
    const users = userData?.users || [];
    const userMap = new Map(users.map((u: any) => [u.id, u.name || u.email || '']));

    return features
      .filter((f: any) => !f.archived)
      .slice(0, limit)
      .map((f: any) => ({
        name: (f.name || '').slice(0, 80),
        type: f.featureType || '',
        owner: userMap.get(f.ownerId) || '',
        updated_at: f.updatedAt ? f.updatedAt.slice(0, 10) : '',
        id: f.id || '',
      }));
  },
});
