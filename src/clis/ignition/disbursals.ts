import { cli, Strategy } from '../../registry.js';

cli({
  site: 'ignition',
  name: 'disbursals',
  access: 'read',
  description: 'List Ignition payment disbursals',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ["id","amount","availableOn","externalId","feeAmount","feeAmountWithTax","feeDescription","message"],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;


    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    const variables: any = { first: limit };

    const body = JSON.stringify({
      query: `
        query PaymentsDisbursals($first: Int!) {
          paymentsDisbursals(first: $first) {
            nodes {
              id
              amount { format }
              availableOn
              externalId
              feeAmount { format }
              feeAmountWithTax { format }
              feeDescription
              message
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

    const nodes: any[] = result?.data?.paymentsDisbursals?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      amount: (node.amount?.format ?? ''),
      availableOn: (node.availableOn ?? '').slice(0, 10),
      externalId: node.externalId ?? '',
      feeAmount: (node.feeAmount?.format ?? ''),
      feeAmountWithTax: (node.feeAmountWithTax?.format ?? ''),
      feeDescription: node.feeDescription ?? '',
      message: node.message ?? '',
    }));
  },
});
