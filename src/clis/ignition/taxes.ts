import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'taxes',
  access: 'read',
  description: 'Taxes from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ["id","name","rate","referenceNumber"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;


    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit };

    const body = JSON.stringify({
      query: `
        query Taxes($first: Int!) {
          taxes(first: $first) {
            nodes {
              id
              name
              rate
              referenceNumber
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

    const nodes: any[] = result?.data?.taxes?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      name: node.name ?? '',
      rate: node.rate ?? '',
      referenceNumber: node.referenceNumber ?? '',
    }));
  },
});
