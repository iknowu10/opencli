import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'services',
  description: 'Services from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'query', default: '', help: 'Filter by name (partial match)' },
  ],
  columns: ["id","name","createdAt","updatedAt","billingLabel","enabledAgreedServicesCount","hourlyPrice","maxPrice"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const filterVars: Record<string, any> = {};
    if (kwargs['query']) filterVars.nameCont = kwargs['query'];

    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit, ...(Object.keys(filterVars).length ? { filter: filterVars } : {}) };

    const body = JSON.stringify({
      query: `
        query Services($first: Int!, $filter: ServiceFilter) {
          services(first: $first, filter: $filter) {
            nodes {
              id
              name
              createdAt
              updatedAt
              billingLabel
              enabledAgreedServicesCount
              hourlyPrice { format }
              maxPrice { format }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables,
    });

    const result = await page.evaluate(`
      (async () => {
        const resp = await fetch('https://go.ignitionapp.com/graphql', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: ${JSON.stringify(body)}
        });
        return resp.json();
      })()
    `);

    const nodes: any[] = result?.data?.services?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      createdAt: (node.createdAt ?? '').slice(0, 10),
      updatedAt: (node.updatedAt ?? '').slice(0, 10),
      billingLabel: node.billingLabel ?? '',
      enabledAgreedServicesCount: node.enabledAgreedServicesCount ?? '',
      hourlyPrice: (node.hourlyPrice?.format ?? ''),
      maxPrice: (node.maxPrice?.format ?? ''),
    }));
  },
});
