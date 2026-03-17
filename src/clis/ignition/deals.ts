import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'deals',
  description: 'Deals from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'state', default: 'all', help: 'Filter by state: all, lost, open, won' },
  ],
  columns: ["id","name","closedAt","formCount","notesCount","position","projectedValue","secondsInStage"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const filterVars: Record<string, any> = {};
    const stateVal = (kwargs['state'] || 'all').toUpperCase();
    if (kwargs['state'] && kwargs['state'] !== 'all') filterVars.stateIn = [stateVal];

    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit, ...(Object.keys(filterVars).length ? { filter: filterVars } : {}) };

    const body = JSON.stringify({
      query: `
        query Deals($first: Int!, $filter: DealFilterType) {
          deals(first: $first, filter: $filter) {
            nodes {
              id
              name
              closedAt
              formCount
              notesCount
              position
              projectedValue { format }
              secondsInStage
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

    const nodes: any[] = result?.data?.deals?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      closedAt: (node.closedAt ?? '').slice(0, 10),
      formCount: node.formCount ?? '',
      notesCount: node.notesCount ?? '',
      position: node.position ?? '',
      projectedValue: (node.projectedValue?.format ?? ''),
      secondsInStage: node.secondsInStage ?? '',
    }));
  },
});
