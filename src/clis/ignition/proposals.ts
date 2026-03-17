import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'proposals',
  description: 'Proposals from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'state', default: 'all', help: 'Filter by state: all, accepted, archived, awaiting_acceptance, completed, draft, lost, new' },
  ],
  columns: ["id","name","createdAt","updatedAt","displayReferenceNumber","acceptedAt","activityError","activityErrorOccurredAt"],
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
        query Proposals($first: Int!, $filter: ProposalFilter) {
          proposals(first: $first, filter: $filter) {
            nodes {
              id
              name
              createdAt
              updatedAt
              displayReferenceNumber
              acceptedAt
              activityError
              activityErrorOccurredAt
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

    const nodes: any[] = result?.data?.proposals?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      createdAt: (node.createdAt ?? '').slice(0, 10),
      updatedAt: (node.updatedAt ?? '').slice(0, 10),
      displayReferenceNumber: node.displayReferenceNumber ?? '',
      acceptedAt: (node.acceptedAt ?? '').slice(0, 10),
      activityError: node.activityError ?? '',
      activityErrorOccurredAt: (node.activityErrorOccurredAt ?? '').slice(0, 10),
    }));
  },
});
