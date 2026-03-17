import { cli, Strategy } from '../../registry.js';
import { latticeGQL } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'feedback',
  description: 'View feedback you have received in Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ['id', 'from', 'message', 'createdAt'],
  func: async (_page, kwargs) => {
    const result = await latticeGQL(`
      query Feedbacks($first: Int) {
        me {
          receivedFeedback(first: $first) {
            nodes {
              id
              message
              createdAt
              fromUser { id name }
              requestType
            }
          }
        }
      }
    `, { first: Number(kwargs.limit) || 20 });

    const nodes: any[] = result?.data?.me?.receivedFeedback?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      from: node.fromUser?.name ?? '',
      message: (node.message ?? '').replace(/\n/g, ' ').slice(0, 120),
      createdAt: (node.createdAt ?? '').slice(0, 10),
    }));
  },
});
