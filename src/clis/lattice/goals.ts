import { cli, Strategy } from '../../registry.js';
import { latticeGQL } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'goals',
  description: 'List your goals/OKRs from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'status', default: '', help: 'Filter by status: ON_TRACK, AT_RISK, BEHIND, ACHIEVED, MISSED' },
  ],
  columns: ['id', 'title', 'progress', 'status', 'dueDate', 'owner'],
  func: async (_page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const variables: Record<string, any> = { first: limit };
    if (kwargs.status) variables.status = [kwargs.status.toUpperCase()];

    const result = await latticeGQL(`
      query Goals($first: Int, $status: [GoalStatus!]) {
        goals(first: $first, status: $status) {
          nodes {
            id
            title
            description
            progressPercent
            status
            dueDate
            ownerUser { id name }
          }
        }
      }
    `, variables);

    const nodes: any[] = result?.data?.goals?.nodes ?? [];
    return nodes.map((node: any) => ({
      id: node.id ?? '',
      title: node.title ?? '',
      progress: node.progressPercent != null ? `${node.progressPercent}%` : '',
      status: node.status ?? '',
      dueDate: (node.dueDate ?? '').slice(0, 10),
      owner: node.ownerUser?.name ?? '',
    }));
  },
});
