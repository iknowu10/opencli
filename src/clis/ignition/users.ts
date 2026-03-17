import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'users',
  description: 'Users from ignition',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ["id","fullName","emailAddress","createdAt","updatedAt","currentSignInAt","firstName","freePricePredictionsRemaining"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;


    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit };

    const body = JSON.stringify({
      query: `
        query Users($first: Int!) {
          users(first: $first) {
            nodes {
              id
              fullName
              emailAddress
              createdAt
              updatedAt
              currentSignInAt
              firstName
              freePricePredictionsRemaining
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

    const nodes: any[] = result?.data?.users?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      fullName: node.fullName ?? '',
      emailAddress: node.emailAddress ?? '',
      createdAt: (node.createdAt ?? '').slice(0, 10),
      updatedAt: (node.updatedAt ?? '').slice(0, 10),
      currentSignInAt: (node.currentSignInAt ?? '').slice(0, 10),
      firstName: node.firstName ?? '',
      freePricePredictionsRemaining: node.freePricePredictionsRemaining ?? '',
    }));
  },
});
