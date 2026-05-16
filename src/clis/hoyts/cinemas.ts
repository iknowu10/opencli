import { cli, Strategy } from '../../registry.js';

cli({
  site: 'hoyts',
  name: 'cinemas',
  access: 'read',
  description: 'HOYTS cinema locations',
  domain: 'www.hoyts.com.au',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'state', default: '', help: 'Filter by state (NSW, VIC, QLD, WA, SA, ACT)' },
  ],
  columns: ['name', 'id', 'state', 'suburb', 'features'],
  func: async (kwargs) => {
    const { state } = kwargs;
    const res = await fetch('https://apim.hoyts.com.au/au/cinemaapi/api/cinemas');
    const cinemas: any[] = await res.json();
    return cinemas
      .filter((c: any) => !state || c.state === String(state).toUpperCase())
      .sort((a: any, b: any) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name))
      .map((c: any) => ({
        name: c.name,
        id: c.id,
        state: c.state,
        suburb: c.address.suburb,
        features: c.features.join(', '),
      }));
  },
});
