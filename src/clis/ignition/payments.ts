import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'payments',
  description: 'List Ignition payments',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    {
      name: 'state',
      default: 'all',
      help: 'Filter by state: all, cancelled, collected, collecting, disbursed, disbursing, refunding, uncollected',
    },
  ],
  columns: ['id', 'client', 'amount', 'state', 'created', 'available_on', 'disbursed'],
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
        query PaymentsPayments($first: Int!, $filter: PaymentFilter) {
          paymentsPayments(first: $first, filter: $filter) {
            nodes {
              id
              state
              createdAt
              availableOn
              client { name }
              amount { format }
              amountDisbursed { format }
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

    const nodes: any[] = result?.data?.paymentsPayments?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      client: node.client?.name ?? '',
      amount: node.amount?.format ?? '',
      state: (node.state ?? '').toLowerCase(),
      created: (node.createdAt ?? '').slice(0, 10),
      available_on: (node.availableOn ?? '').slice(0, 10),
      disbursed: node.amountDisbursed?.format ?? '',
    }));
  },
});
