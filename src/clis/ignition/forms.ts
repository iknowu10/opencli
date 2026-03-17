import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'forms',
  description: 'Forms from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'query', default: '', help: 'Filter by name (partial match)' },
    { name: 'state', default: 'all', help: 'Filter by state: all, awaiting, submitted' },
  ],
  columns: ["id","name","createdAt","completedMessageTitle","portalUrl","questionsCount","requestedAt","sentAt"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const filterVars: Record<string, any> = {};
    if (kwargs['query']) filterVars.nameCont = kwargs['query'];
    const stateVal = (kwargs['state'] || 'all').toUpperCase();
    if (kwargs['state'] && kwargs['state'] !== 'all') filterVars.stateIn = [stateVal];

    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit, ...(Object.keys(filterVars).length ? { filter: filterVars } : {}) };

    const body = JSON.stringify({
      query: `
        query Forms($first: Int!, $filter: FormFilterType) {
          forms(first: $first, filter: $filter) {
            nodes {
              id
              name
              createdAt
              completedMessageTitle
              portalUrl
              questionsCount
              requestedAt
              sentAt
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

    const nodes: any[] = result?.data?.forms?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      createdAt: (node.createdAt ?? '').slice(0, 10),
      completedMessageTitle: node.completedMessageTitle ?? '',
      portalUrl: node.portalUrl ?? '',
      questionsCount: node.questionsCount ?? '',
      requestedAt: (node.requestedAt ?? '').slice(0, 10),
      sentAt: (node.sentAt ?? '').slice(0, 10),
    }));
  },
});
