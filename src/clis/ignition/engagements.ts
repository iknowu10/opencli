import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'engagements',
  access: 'read',
  description: 'Engagements from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ["id","name","createdAt","acceptanceToken","acceptedAt","acceptedBy","acceptedByAccountant","billingPeriodCount"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;


    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit };

    const body = JSON.stringify({
      query: `
        query Engagements($first: Int!) {
          engagements(first: $first) {
            nodes {
              id
              name
              createdAt
              acceptanceToken
              acceptedAt
              acceptedBy
              acceptedByAccountant
              billingPeriodCount
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

    const nodes: any[] = result?.data?.engagements?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      createdAt: (node.createdAt ?? '').slice(0, 10),
      acceptanceToken: node.acceptanceToken ?? '',
      acceptedAt: (node.acceptedAt ?? '').slice(0, 10),
      acceptedBy: node.acceptedBy ?? '',
      acceptedByAccountant: node.acceptedByAccountant ?? '',
      billingPeriodCount: node.billingPeriodCount ?? '',
    }));
  },
});
