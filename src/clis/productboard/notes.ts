import { cli, Strategy } from '../../registry.js';
import { pbFetch } from './utils.js';

cli({
  site: 'productboard',
  name: 'notes',
  access: 'read',
  description: 'List customer notes/insights from Productboard',
  domain: 'ignitionapp.productboard.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'query', type: 'string', positional: true, required: false, help: 'Search keyword (matches name and content)' },
    { name: 'limit', type: 'int', default: 30, help: 'Max notes to return' },
  ],
  columns: ['name', 'source', 'state', 'created_at', 'id'],
  func: async (_page: any, kwargs: any) => {
    const limit = kwargs.limit || 30;
    const query = (kwargs.query || '').toLowerCase();
    const data = await pbFetch('/api/notes');
    let notes = data?.notes || [];

    if (query) {
      notes = notes.filter((n: any) => {
        const name = (n.name || '').toLowerCase();
        const content = (n.content || '').toLowerCase();
        return name.includes(query) || content.includes(query);
      });
    }

    return notes.slice(0, limit).map((n: any) => ({
      name: (n.name || '').slice(0, 80),
      source: n.source || '',
      state: n.state || '',
      created_at: n.createdAt ? n.createdAt.slice(0, 10) : '',
      id: n.id || '',
    }));
  },
});
