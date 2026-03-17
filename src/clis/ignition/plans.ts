import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'plans',
  description: 'Plans from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ["name","code","position","price","priceMonthly","shortDescription","taxCode","version"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;


    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit };

    const body = JSON.stringify({
      query: `
        query Plans($first: Int!) {
          plans(first: $first) {
            nodes {
              name
              code
              position
              price { format }
              priceMonthly { format }
              shortDescription
              taxCode
              version
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

    const nodes: any[] = result?.data?.plans?.nodes ?? [];
    return nodes.map((node: any) => ({
      name: node.name ?? '',
      code: node.code ?? '',
      position: node.position ?? '',
      price: (node.price?.format ?? ''),
      priceMonthly: (node.priceMonthly?.format ?? ''),
      shortDescription: node.shortDescription ?? '',
      taxCode: node.taxCode ?? '',
      version: node.version ?? '',
    }));
  },
});
